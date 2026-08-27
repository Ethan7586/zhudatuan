import React from 'react';
import { Flame, Plus } from 'lucide-react';
import { useMall } from '../../context/MallContext';

export const MPProductFeed: React.FC = () => {
  const { setMpPage, addToCart, presentationProducts: products } = useMall();
  const feedProducts = products.slice(0, 8);
  return (
    <>
      {/* 瀑布流双列商品 Feed */}
      <div className="px-3 mt-3 pb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-red-500" />
            <h3 className="text-xs font-black text-gray-900">精选福利热兑榜</h3>
          </div>
          <span className="text-[10px] text-gray-400">实时按企采兑换排序</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {feedProducts.map((p) => (
            <div key={p.id} onClick={() => setMpPage('detail', p.id)} className="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100 flex flex-col justify-between cursor-pointer active:scale-98 transition-transform">
              <div className="relative aspect-square bg-gray-50">
                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                <span className="absolute top-1.5 left-1.5 bg-[var(--sw-brand-dark)]/90 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                  {p.itemType === 'virtual_coupon' ? '电子券' : p.itemType === 'nearby_store' ? '到店核销' : '企采实物'}
                </span>
              </div>

              <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-800 line-clamp-2 leading-snug">{p.title}</h4>
                  <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{p.subtitle}</p>
                </div>

                <div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-blue-700 bg-blue-50 font-bold px-1 py-0.2 rounded">福利卡全额扣</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-xs font-black text-[#E5484D] font-mono">¥{p.price}</div>
                      <div className="text-[9px] text-gray-400 line-through">¥{p.originalPrice}</div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p, 1);
                      }}
                      className="w-6 h-6 rounded-full bg-[var(--sw-brand)] text-white flex items-center justify-center shadow-xs hover:bg-blue-700 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
