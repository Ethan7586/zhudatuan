import express, { type NextFunction, type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { decide } from '@smart-wing/authz';
import { PERMISSIONS, type Permission } from '@smart-wing/api-contract';
import { resolveMembershipRuntime } from './api/membershipContext';
import { readSession } from './api/session';
import type { WorkerEnv } from './api/types';

const repositoryRoot = process.cwd();
const adminWebRoot = path.join(repositoryRoot, 'apps', 'admin-web');
dotenv.config({ path: process.env.ENV_FILE ?? path.join(repositoryRoot, '.env.production') });

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

function isLocalDevelopment(): boolean {
  return process.env.APP_ENV === 'development' && process.env.AUTH_MODE === 'development';
}

/**
 * AI endpoints consume paid provider quota. A host-only admin cookie alone is
 * not authority: every endpoint declares the business permission it needs.
 */
function requireAdminPermission(permission: Permission) {
  return async (request: ExpressRequest, response: ExpressResponse, next: NextFunction): Promise<void> => {
    if (isLocalDevelopment()) {
      next();
      return;
    }

    try {
      const session = await readSession(
        new Request(`https://smart.hbbtzn.com${request.originalUrl}`, {
          headers: { cookie: request.headers.cookie ?? '' },
        }),
        process.env as WorkerEnv
      );
      if (!session || session.target !== 'admin') {
        response.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
        return;
      }
      const runtime = await resolveMembershipRuntime(
        new Request(`https://smart.hbbtzn.com${request.originalUrl}`, {
          headers: { cookie: request.headers.cookie ?? '' },
        }),
        process.env as WorkerEnv
      );
      if (!runtime) {
        response.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
        return;
      }
      const decision = decide(
        runtime.membership,
        permission,
        {
          tenantId: runtime.membership.context.tenantId,
          enterpriseId: runtime.membership.context.enterpriseId,
          mallId: runtime.membership.context.mallId,
          supplierId: runtime.membership.context.supplierId,
          ownerUserId: runtime.membership.context.userId,
        },
        { stepUpAt: runtime.authorization.stepUpAt }
      );
      if (!decision.allowed) {
        response.status(403).json({ error: 'FORBIDDEN', reason: decision.reason });
        return;
      }
      next();
    } catch {
      response.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
    }
  };
}

// Lazy GoogleGenAI client initialization
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      genAIClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return genAIClient;
}

// API Route: Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Route 1: AI Product Classification Copilot
app.post('/api/ai/classify-product', requireAdminPermission(PERMISSIONS.productPublish), async (req, res) => {
  try {
    const { title, attributes, supplierCategory, price } = req.body;
    const ai = getGenAI();

    if (!ai) {
      // Intelligent fallback when API key is not configured or in sandbox mock
      return res.json({
        categoryL1: supplierCategory?.split('>')[0] || '数码家电',
        categoryL2: supplierCategory?.split('>')[1] || '智能办公',
        categoryL3: supplierCategory?.split('>')[2] || '智能外设/配件',
        confidence: 88,
        reasoning: `基于商品标题"${title || '智能硬件'}"及属性配置，自动匹配到3级电商标准品类。`,
        isMockFallback: true,
      });
    }

    const prompt = `你是一个企业福利商城的品类治理专家AI。请分析以下商品信息，给出一符合标准电商三级类目的分类预测。
商品标题：${title || '未知商品'}
供应商类目：${supplierCategory || '未指定'}
属性特征：${JSON.stringify(attributes || {})}
商品价格：¥${price || 0}

请严格按 JSON 格式返回以下字段：
1. categoryL1: 一级类目 (如 "数码家电", "食品生鲜", "家居日用", "运动户外", "礼品卡券", "办公用品")
2. categoryL2: 二级类目
3. categoryL3: 三级类目
4. confidence: 0到100之间的整数置信度 (若信息不足则低于70)
5. reasoning: 100字以内的推荐依据说明`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryL1: { type: Type.STRING },
            categoryL2: { type: Type.STRING },
            categoryL3: { type: Type.STRING },
            confidence: { type: Type.INTEGER },
            reasoning: { type: Type.STRING },
          },
          required: ['categoryL1', 'categoryL2', 'categoryL3', 'confidence', 'reasoning'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json(result);
  } catch (error: any) {
    console.error('AI Classify Product Error:', error);
    res.status(500).json({
      error: 'Classification failed',
      message: error.message || 'AI服务响应异常',
      categoryL1: '办公用品',
      categoryL2: '办公设备',
      categoryL3: '通用耗材',
      confidence: 65,
      reasoning: 'AI接口暂时不可用，已自动兜底为通用办公品类，需人工复核。',
    });
  }
});

// API Route 2: AI Operational Anomaly Copilot
app.post('/api/ai/operational-copilot', requireAdminPermission(PERMISSIONS.orderRead), async (req, res) => {
  try {
    const { anomalyData } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        summaryTitle: '库存冲突与国网福利预算超支预警',
        whatHappened: '检测到 3 笔高优先级异常：1笔中铁建员工订单因供应商库存同步延迟发生物理超卖，1笔国家电网华北分公司季度福利预算消耗达到92.4%触发预警阈值，1笔大额退款工单超过SLA时限未处理。',
        affectedCount: 3420,
        totalAmount: 184500,
        probableCauses: ['供应商A（得力办公）API接口在 14:00-14:20 间出现 504 Gateway Timeout，致使锁库失败', '国网华北分公司集中在发薪日后3天爆发集中兑换，预算消耗曲线比历史均值高出 38%'],
        suggestedActions: ['一键向得力供应商发起异常库存二次校准（推荐）', '临时将国网华北分公司超支部门（HR部/运维部）单笔上限下调 15%', '指派客服专员张伟在15分钟内人工接入该笔退款工单'],
        confidence: 94,
        isMockFallback: true,
      });
    }

    const prompt = `你是一个企业福利商城运营后台的AI运营 Copilot。
请根据以下发生的实时异常数据，生成一份结构化诊断分析：
异常数据上下文：${JSON.stringify(anomalyData || {})}

请严格返回 JSON：
1. summaryTitle: 简短异常诊断标题
2. whatHappened: 简明描述发生了什么（150字以内）
3. affectedCount: 影响用户/员工人数（整数）
4. totalAmount: 涉及金额（人民币整数）
5. probableCauses: 字符串数组，2-3条可能的归因分析
6. suggestedActions: 字符串数组，2-3条建议处置动作
7. confidence: 置信度百分比（0-100的整数）`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryTitle: { type: Type.STRING },
            whatHappened: { type: Type.STRING },
            affectedCount: { type: Type.INTEGER },
            totalAmount: { type: Type.INTEGER },
            probableCauses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            confidence: { type: Type.INTEGER },
          },
          required: ['summaryTitle', 'whatHappened', 'affectedCount', 'totalAmount', 'probableCauses', 'suggestedActions', 'confidence'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json(result);
  } catch (error: any) {
    console.error('AI Operational Copilot Error:', error);
    res.status(500).json({
      error: 'Copilot analysis failed',
      message: error.message || 'AI分析异常',
    });
  }
});

async function startServer() {
  const distPath = path.join(adminWebRoot, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.use((error: unknown, _request: ExpressRequest, response: ExpressResponse, _next: NextFunction) => {
    if (error instanceof SyntaxError || (typeof error === 'object' && error !== null && 'type' in error && (error as { type?: string }).type === 'entity.too.large')) {
      response.status(400).json({ error: 'INVALID_REQUEST_BODY' });
      return;
    }
    console.error(JSON.stringify({ level: 'error', event: 'admin_http_error' }));
    response.status(500).json({ error: 'INTERNAL_ERROR' });
  });

  // 仅由本机 Caddy 反向代理暴露，避免绕过 TLS、WAF 与域名级会话隔离。
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Smart Wing Admin Console listening on 127.0.0.1:${PORT}`);
  });
}

startServer();
