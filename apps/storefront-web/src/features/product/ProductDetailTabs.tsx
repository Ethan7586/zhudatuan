import React from 'react';
import { Building2, FileText, MessageSquare, ShieldCheck, Star } from 'lucide-react';
import { useMall } from '../../context/MallContext';
import type { Product } from '../../types';

type DetailTab = 'detail' | 'params' | 'reviews' | 'aftersale';

interface ProductDetailTabsProps {
  product: Product;
  activeTab: DetailTab;
  setActiveTab: React.Dispatch<React.SetStateAction<DetailTab>>;
}

export const ProductDetailTabs: React.FC<ProductDetailTabsProps> = ({ product, activeTab, setActiveTab }) => {
  const { currentMall } = useMall();
  return (
    <>
      {/* 3. 详情四大 Tab 选项卡 */}
      <div className="bg-white border border-gray-200 rounded-md shadow-xs overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-bold text-gray-700">
          {[
            { id: 'detail', label: '商品详情与介绍', icon: FileText },
            { id: 'params', label: '规格参数', icon: Building2 },
            { id: 'reviews', label: `累计评价 (${product.reviewCount})`, icon: MessageSquare },
            { id: 'aftersale', label: '国企售后与履约承诺', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 cursor-pointer transition-colors ${
                  isActive ? 'border-[var(--sw-brand)] bg-white text-[var(--sw-brand)]' : 'border-transparent text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6 text-xs text-gray-800 leading-relaxed">
          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="bg-blue-50/50 p-4 rounded border border-blue-100 text-gray-700">
                <h4 className="font-bold text-gray-900 mb-1">【{currentMall.enterpriseName} 福利采购选品说明】</h4>
                <p>本商品已通过央企/国企商品合规集采认证，正品保证。使用福利卡或餐卡付款享受官方协议价，并开具对公增值税发票。</p>
              </div>

              {product.descriptionDetailText && (
                <div className="space-y-3 text-sm">
                  {product.descriptionDetailText.map((p, i) => (
                    <p key={i} className="text-gray-700">
                      {p}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-4 pt-4">
                <div className="font-bold text-sm text-gray-900 border-l-4 border-[var(--sw-brand)] pl-2">实物图赏与包装细节</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {product.images.map((img, idx) => (
                    <img key={idx} src={img} alt="" className="w-full rounded border border-gray-200 object-cover" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'params' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-gray-900 border-l-4 border-[var(--sw-brand)] pl-2">详细规格参数清单</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 bg-gray-50 p-4 rounded border border-gray-200">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">商品名称</span>
                  <span className="font-medium text-gray-900">{product.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">所属品牌</span>
                  <span className="font-medium text-gray-900">{product.brand}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">供应渠道</span>
                  <span className="font-medium text-gray-900">{product.supplierName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">履约时效</span>
                  <span className="font-medium text-gray-900">{product.deliverySla}</span>
                </div>

                {product.params &&
                  product.params.map((pm, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-500">{pm.key}</span>
                      <span className="font-medium text-gray-900">{pm.value}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center gap-6 bg-gray-50 p-4 rounded border border-gray-200">
                <div className="text-center border-r border-gray-200 pr-6">
                  <div className="text-3xl font-black text-[#FF7A00]">{product.rating}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">综合满意度</div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-gray-800">99.8% 的员工推荐此商品</div>
                  <div className="text-gray-500 text-xs">“发货迅速，质量好，福利卡抵扣顺畅。”</div>
                </div>
              </div>

              {/* Sample Reviews */}
              <div className="divide-y divide-gray-100">
                {[
                  {
                    name: '李*平 (国家电网员工)',
                    date: '2026-07-20',
                    text: '福利卡直接全额抵扣，第二天就顺丰寄到了，品质非常高，感谢单位好福利！',
                    star: 5,
                  },
                  {
                    name: '王* (中航工业员工)',
                    date: '2026-07-18',
                    text: '包装完好无损，正品验货没问题，餐卡余额正好花掉，物超所值。',
                    star: 5,
                  },
                ].map((rev, i) => (
                  <div key={i} className="py-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800">{rev.name}</span>
                      <span className="text-gray-400">{rev.date}</span>
                    </div>
                    <div className="flex text-amber-400">
                      {Array.from({ length: rev.star }).map((_, s) => (
                        <Star key={s} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <p className="text-gray-700">{rev.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'aftersale' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-gray-900 border-l-4 border-[var(--sw-brand)] pl-2">国企采买售后服务保障</h4>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                <li>
                  <strong>开具正规发票：</strong>
                  订单完成后可在线申请开具增值税普通/专用发票，支持个人与企业抬头。
                </li>
                <li>
                  <strong>无忧退换：</strong>7天无理由退换货（虚拟卡券及已核销商品除外）。
                </li>
                <li>
                  <strong>福利余额原路退回：</strong>
                  若发生退款，福利卡或餐卡扣减部分将原路实时退回您的个人账户。
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
