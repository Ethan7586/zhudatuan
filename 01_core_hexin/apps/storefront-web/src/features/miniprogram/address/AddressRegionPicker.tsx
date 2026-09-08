import React from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { loadChinaRegions, type ChinaRegionTree, type RegionArea } from './chinaRegions';
import {
  resolveRegionSelection,
  selectCity,
  selectDistrict,
  selectProvince,
  type RegionSelection,
  type ResolvedRegionSelection,
} from './regionSelection';

const ROW_HEIGHT = 44;

interface AddressRegionPickerProps {
  value: RegionSelection;
  onCancel: () => void;
  onConfirm: (value: RegionSelection) => void;
}

export function AddressRegionPicker({ value, onCancel, onConfirm }: AddressRegionPickerProps) {
  const [regions, setRegions] = React.useState<ChinaRegionTree>();
  const [draft, setDraft] = React.useState<ResolvedRegionSelection>();

  React.useEffect(() => {
    let active = true;
    void loadChinaRegions().then((loaded) => {
      if (!active) return;
      setRegions(loaded);
      setDraft(resolveRegionSelection(loaded, value));
    });
    return () => { active = false; };
  }, [value]);

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onCancel]);

  return (
    <div className="sw-address-sheet fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="选择省市区">
      <button type="button" aria-label="取消选择地区" className="sw-address-sheet-backdrop absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={onCancel} />
      <section className="sw-address-sheet-panel relative w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-[#FBFCFE] shadow-[0_-20px_60px_rgba(15,35,70,0.18)]">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
          <button type="button" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition active:scale-95 active:bg-slate-100" aria-label="取消">
            <X className="h-[18px] w-[18px]" />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-[13px] font-black text-slate-900"><MapPin className="h-3.5 w-3.5 text-[var(--sw-brand)]" />选择所在地区</div>
            <p className="mt-0.5 text-[9px] tracking-[0.14em] text-slate-400">上下滑动 · 轻触完成</p>
          </div>
          <button
            type="button"
            disabled={!draft}
            onClick={() => draft && onConfirm({ province: draft.province, city: draft.city, district: draft.district })}
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sw-brand)] text-white shadow-[0_6px_18px_rgba(37,99,235,0.25)] transition active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
            aria-label="完成地区选择"
          >
            <Check className="h-[17px] w-[17px]" />
          </button>
        </header>

        {regions && draft ? (
          <div className="relative px-3 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
            <div className="pointer-events-none absolute left-4 right-4 top-[100px] h-11 rounded-xl border border-blue-100/80 bg-gradient-to-r from-blue-50/60 via-white/90 to-blue-50/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />
            <div className="grid grid-cols-3 gap-1" data-region-wheel="three-column">
              <WheelColumn
                label="省"
                options={regions}
                selectedIndex={draft.provinceIndex}
                onSelect={(index) => setDraft(selectProvince(regions, index))}
              />
              <WheelColumn
                label="市"
                options={draft.provinceOption.cities}
                selectedIndex={draft.cityIndex}
                onSelect={(index) => setDraft(selectCity(regions, draft, index))}
              />
              <WheelColumn
                label="区"
                options={draft.cityOption.districts}
                selectedIndex={draft.districtIndex}
                onSelect={(index) => setDraft(selectDistrict(regions, draft, index))}
              />
            </div>
            <p className="mt-2 truncate px-2 text-center text-[10px] font-medium text-slate-500" aria-live="polite">
              {draft.province} · {draft.city} · {draft.district}
            </p>
          </div>
        ) : (
          <div className="grid h-[264px] place-items-center" aria-label="地区数据加载中">
            <FrostDewLoader />
          </div>
        )}
      </section>
    </div>
  );
}

function WheelColumn({ label, options, selectedIndex, onSelect }: Readonly<{
  label: string;
  options: readonly RegionArea[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}>) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const settleTimerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const target = scrollerRef.current;
    if (!target) return;
    target.scrollTop = selectedIndex * ROW_HEIGHT;
  }, [options, selectedIndex]);

  React.useEffect(() => () => {
    if (settleTimerRef.current !== undefined) window.clearTimeout(settleTimerRef.current);
  }, []);

  const settle = () => {
    const target = scrollerRef.current;
    if (!target) return;
    if (settleTimerRef.current !== undefined) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      const nextIndex = Math.max(0, Math.min(Math.round(target.scrollTop / ROW_HEIGHT), options.length - 1));
      const snappedTop = nextIndex * ROW_HEIGHT;
      if (Math.abs(target.scrollTop - snappedTop) > 0.5) {
        target.scrollTo({ top: snappedTop, behavior: 'smooth' });
      }
      if (nextIndex !== selectedIndex) onSelect(nextIndex);
    }, 88);
  };

  return (
    <div className="min-w-0">
      <div className="mb-1 text-center text-[9px] font-bold tracking-[0.18em] text-slate-400">{label}</div>
      <div
        ref={scrollerRef}
        onScroll={settle}
        className="sw-address-wheel relative h-[220px] snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{
          paddingBlock: `${ROW_HEIGHT * 2}px`,
          scrollbarWidth: 'none',
          touchAction: 'pan-y',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 23%, black 77%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 23%, black 77%, transparent 100%)',
        }}
        role="listbox"
        aria-label={`${label}选择`}
      >
        {options.map((option, index) => (
          <button
            type="button"
            key={option.code}
            role="option"
            aria-selected={index === selectedIndex}
            onClick={() => onSelect(index)}
            className={`block h-11 w-full snap-center truncate px-1 text-center text-[12px] transition-[color,font-size,opacity] duration-200 ${index === selectedIndex ? 'font-black text-slate-950' : 'font-medium text-slate-400'}`}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function FrostDewLoader() {
  return (
    <span className="sw-auth-frost-dew h-9 w-24" aria-hidden="true">
      <span className="sw-auth-frost-dew-ring" />
      <span className="sw-auth-frost-dew-orb" />
    </span>
  );
}
