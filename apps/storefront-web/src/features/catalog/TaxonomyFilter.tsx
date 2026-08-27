import { TAXONOMY_LEAF_NAMES } from '../../domain/catalog/taxonomy';

type TaxonomyOption = {
  code: string;
  label: string;
};

type TaxonomyFilterProps = {
  options: TaxonomyOption[];
  selected: string;
  onSelect: (code: string) => void;
  title?: string;
};

export function TaxonomyFilter({ options, selected, onSelect, title }: TaxonomyFilterProps) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-start gap-4 pb-2.5 border-b border-gray-100">
      <span className="w-20 font-bold text-gray-700 flex-shrink-0 pt-1">{title || '细分类目'}：</span>
      <div className="flex-1 flex flex-wrap gap-1.5">
        <button onClick={() => onSelect('all')} className={chipClass(selected === 'all')}>
          全部细类
        </button>
        {options.map((option) => (
          <button key={option.code} onClick={() => onSelect(option.code)} className={chipClass(selected === option.code)}>
            {TAXONOMY_LEAF_NAMES[option.code] ?? option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function chipClass(isActive: boolean) {
  return `px-2.5 py-1 rounded cursor-pointer ${isActive ? 'bg-[var(--sw-brand-dark)] text-white font-bold' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;
}
