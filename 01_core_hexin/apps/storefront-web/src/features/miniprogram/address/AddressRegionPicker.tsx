import React from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { getLoadedChinaRegions, loadChinaRegions, type ChinaRegionTree, type RegionArea } from './chinaRegions';
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
  const cachedRegions = getLoadedChinaRegions();
  const [regions, setRegions] = React.useState<ChinaRegionTree | undefined>(cachedRegions);
  const [draft, setDraft] = React.useState<ResolvedRegionSelection | undefined>(() => (
    cachedRegions ? resolveRegionSelection(cachedRegions, value) : undefined
  ));
  const economyEffects = React.useMemo(prefersEconomyEffects, []);

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
    <div
      className="sw-address-sheet fixed inset-0 z-[80] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="选择省市区"
      aria-busy={!draft}
      data-economy-effects={economyEffects ? 'true' : 'false'}
      data-region-picker-state={draft ? 'ready' : 'loading'}
    >
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
            <div className="grid h-4 grid-cols-3 gap-1" aria-hidden="true">
              {['省', '市', '区'].map((label) => <div key={label} className="text-center text-[9px] font-bold leading-4 tracking-[0.18em] text-slate-400">{label}</div>)}
            </div>
            <div className="relative mt-1">
              <div
                className="pointer-events-none absolute inset-x-1 top-1/2 z-[1] h-11 -translate-y-1/2 rounded-[var(--sw-radius-md)] border border-[var(--sw-border)] bg-white/80 shadow-[var(--sw-shadow-card)]"
                data-region-selection-frame
              />
              <div className="relative z-[2] grid grid-cols-3 gap-1" data-region-wheel="three-column">
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
            </div>
            <p className="mt-2 truncate px-2 text-center text-[10px] font-medium text-slate-500" aria-live="polite">
              {draft.province} · {draft.city} · {draft.district}
            </p>
          </div>
        ) : (
          <div className="relative px-3 pb-[max(18px,env(safe-area-inset-bottom))] pt-3" aria-label="地区数据加载中">
            <div className="grid h-4 grid-cols-3 gap-1" aria-hidden="true">
              {['省', '市', '区'].map((label) => <div key={label} className="text-center text-[9px] font-bold leading-4 tracking-[0.18em] text-slate-400">{label}</div>)}
            </div>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-x-1 top-1/2 z-[1] h-11 -translate-y-1/2 rounded-[var(--sw-radius-md)] border border-[var(--sw-border)] bg-white/80" data-region-selection-frame />
              <div className="relative z-[2] grid grid-cols-3 gap-1" data-region-wheel="loading">
                {['省', '市', '区'].map((label) => <WheelSkeleton key={label} label={label} />)}
              </div>
              <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center">
                <FrostDewLoader />
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] font-medium text-slate-400" aria-live="polite">正在准备地区数据</p>
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
  const animationFrameRef = React.useRef<number | undefined>(undefined);
  const optionsRef = React.useRef(options);
  const scrollSelectedIndexRef = React.useRef<number | undefined>(undefined);
  const lastPublishedIndexRef = React.useRef(selectedIndex);

  React.useLayoutEffect(() => {
    const target = scrollerRef.current;
    if (!target) return;
    const optionsChanged = optionsRef.current !== options;
    const selectionCameFromScroll = !optionsChanged && scrollSelectedIndexRef.current === selectedIndex;
    optionsRef.current = options;
    scrollSelectedIndexRef.current = undefined;
    lastPublishedIndexRef.current = selectedIndex;
    if (!selectionCameFromScroll) target.scrollTop = selectedIndex * ROW_HEIGHT;
  }, [options, selectedIndex]);

  React.useEffect(() => () => {
    if (animationFrameRef.current !== undefined) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const updateCenteredOption = () => {
    const target = scrollerRef.current;
    if (!target || animationFrameRef.current !== undefined) return;
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = undefined;
      const nextIndex = Math.max(0, Math.min(Math.round(target.scrollTop / ROW_HEIGHT), options.length - 1));
      if (nextIndex === lastPublishedIndexRef.current) return;
      lastPublishedIndexRef.current = nextIndex;
      scrollSelectedIndexRef.current = nextIndex;
      onSelect(nextIndex);
    });
  };

  return (
    <div className="min-w-0">
      <div
        ref={scrollerRef}
        onScroll={updateCenteredOption}
        className="sw-address-wheel relative h-[220px] snap-y snap-proximity overflow-y-auto overscroll-contain"
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
            className={`flex h-11 w-full snap-center items-center justify-center px-1 text-center text-[12px] leading-none transition-[color,font-size,opacity] duration-100 motion-reduce:transition-none ${index === selectedIndex ? 'font-black text-slate-950' : 'font-medium text-slate-400'}`}
          >
            <span className="block max-w-full truncate">{option.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WheelSkeleton({ label }: Readonly<{ label: string }>) {
  return (
    <div className="min-w-0" data-region-wheel-skeleton={label}>
      <div className="grid h-[220px] grid-rows-5 py-[44px]" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <span key={row} className={`mx-auto my-auto h-2 rounded-full bg-slate-200/70 ${row === 1 ? 'w-12' : 'w-8 opacity-60'}`} />
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

function prefersEconomyEffects(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const reducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return reducedMotion
    || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
    || (deviceMemory !== undefined && deviceMemory <= 4);
}
