import { deepFreeze } from '../../../shared/model/Immutable';
import type { ExperienceDocument } from './Experience';

export interface VersionDifference {
  readonly path: string;
  readonly label: string;
  readonly local: string;
  readonly current: string;
  readonly overlaps: boolean;
}

export interface VersionMergePlan {
  readonly differences: readonly VersionDifference[];
  readonly merged: ExperienceDocument;
  readonly safe: boolean;
  readonly needsSave: boolean;
}

export function planVersionMerge(base: ExperienceDocument, local: ExperienceDocument, current: ExperienceDocument): VersionMergePlan {
  const differences: VersionDifference[] = [];
  const merged = mergeValue(base, local, current, '', differences) as ExperienceDocument;
  return Object.freeze({
    differences: Object.freeze(differences),
    merged: deepFreeze(merged),
    safe: differences.every((item) => !item.overlaps),
    needsSave: !equalValue(merged, current),
  });
}

function mergeValue(base: unknown, local: unknown, current: unknown, path: string, differences: VersionDifference[]): unknown {
  if (equalValue(local, current)) return local;
  if (plainRecord(base) && plainRecord(local) && plainRecord(current)) {
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(current)]);
    for (const key of keys) {
      const value = mergeValue(base[key], local[key], current[key], join(path, key), differences);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(current) && comparableArrays(base, local, current)) {
    return local.map((_, index) => mergeValue(base[index], local[index], current[index], join(path, String(index)), differences));
  }
  if (equalValue(local, base)) {
    differences.push(difference(path, local, current, false));
    return current;
  }
  if (equalValue(current, base)) {
    differences.push(difference(path, local, current, false));
    return local;
  }
  differences.push(difference(path, local, current, true));
  return current;
}

function comparableArrays(base: readonly unknown[], local: readonly unknown[], current: readonly unknown[]): boolean {
  if (base.length !== local.length || local.length !== current.length) return false;
  return base.every((item, index) => identity(item) === identity(local[index]) && identity(item) === identity(current[index]));
}

function identity(value: unknown): string | undefined {
  return plainRecord(value) && typeof value.id === 'string' ? value.id : undefined;
}

function difference(path: string, local: unknown, current: unknown, overlaps: boolean): VersionDifference {
  return Object.freeze({ path, label: fieldLabel(path), local: displayValue(local), current: displayValue(current), overlaps });
}

function fieldLabel(path: string): string {
  const page = /^pages\.(\d+)/.exec(path);
  const block = /^pages\.(\d+)\.blocks\.(\d+)/.exec(path);
  const content = /^pages\.(\d+)\.blocks\.(\d+)\.content\.([^.]+)$/.exec(path);
  const navigation = /^navigation\.(\d+)\.label$/.exec(path);
  if (content) return `第 ${Number(content[1]) + 1} 页 · 第 ${Number(content[2]) + 1} 个组件 · ${contentLabel(content[3]!)}`;
  if (block) return `第 ${Number(block[1]) + 1} 页 · 第 ${Number(block[2]) + 1} 个组件${path.endsWith('.action.target') ? '点击目标' : path.endsWith('.action.type') ? '点击行为' : path.endsWith('.component') ? '类型' : '配置'}`;
  if (path === 'pages' || path === 'navigation') return '页面结构与顺序';
  if (page) return `第 ${Number(page[1]) + 1} 页${path.endsWith('.path') ? '路径' : '配置'}`;
  if (navigation) return `第 ${Number(navigation[1]) + 1} 个导航名称`;
  if (path === 'theme.preset') return '主题方案';
  if (path === 'theme.primaryColor') return '主品牌色';
  if (path === 'theme.accentColor') return '强调色';
  if (path.startsWith('theme.')) return '品牌视觉资源';
  if (path === 'assets' || path.startsWith('assets.')) return '视觉资源清单';
  return '装修配置';
}

function contentLabel(key: string): string {
  return ({ title: '标题', subtitle: '副标题', eyebrow: '眉题', description: '说明', announcement: '公告', content: '正文', text: '正文', collectionId: '商品集合', pool: '商品池', displayLimit: '展示数量', items: '快捷入口' } as Record<string, string>)[key] ?? '内容';
}

function displayValue(value: unknown): string {
  if (value === undefined) return '已删除';
  if (value === null || value === '') return '未设置';
  if (typeof value === 'boolean') return value ? '开启' : '关闭';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  if (Array.isArray(value)) return `${value.length} 项`;
  return '完整配置已变化';
}

function equalValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equalValue(item, right[index]));
  if (!plainRecord(left) || !plainRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(right, key) && equalValue(left[key], right[key]));
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}
