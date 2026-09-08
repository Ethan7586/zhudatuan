import type { ChinaRegionTree, RegionCity, RegionProvince } from './chinaRegions';

export interface RegionSelection {
  province: string;
  city: string;
  district: string;
}

export interface ResolvedRegionSelection extends RegionSelection {
  provinceIndex: number;
  cityIndex: number;
  districtIndex: number;
  provinceOption: RegionProvince;
  cityOption: RegionCity;
}

export function resolveRegionSelection(
  regions: ChinaRegionTree,
  value: RegionSelection,
): ResolvedRegionSelection | undefined {
  const provinceIndex = matchingIndex(regions, value.province);
  const provinceOption = regions[provinceIndex] ?? regions[0];
  if (!provinceOption) return undefined;

  const cityIndex = matchingIndex(provinceOption.cities, value.city);
  const cityOption = provinceOption.cities[cityIndex] ?? provinceOption.cities[0];
  if (!cityOption) return undefined;

  const districtIndex = matchingIndex(cityOption.districts, value.district);
  const districtOption = cityOption.districts[districtIndex] ?? cityOption.districts[0];

  return {
    province: provinceOption.name,
    city: cityOption.name,
    district: districtOption?.name ?? '',
    provinceIndex: Math.max(0, provinceIndex),
    cityIndex: Math.max(0, cityIndex),
    districtIndex: Math.max(0, districtIndex),
    provinceOption,
    cityOption,
  };
}

export function selectProvince(regions: ChinaRegionTree, index: number): ResolvedRegionSelection | undefined {
  const province = regions[clamp(index, regions.length)];
  if (!province) return undefined;
  return resolveRegionSelection(regions, { province: province.name, city: '', district: '' });
}

export function selectCity(
  regions: ChinaRegionTree,
  current: RegionSelection,
  index: number,
): ResolvedRegionSelection | undefined {
  const resolved = resolveRegionSelection(regions, current);
  if (!resolved) return undefined;
  const city = resolved.provinceOption.cities[clamp(index, resolved.provinceOption.cities.length)];
  if (!city) return resolved;
  return resolveRegionSelection(regions, {
    province: resolved.province,
    city: city.name,
    district: '',
  });
}

export function selectDistrict(
  regions: ChinaRegionTree,
  current: RegionSelection,
  index: number,
): ResolvedRegionSelection | undefined {
  const resolved = resolveRegionSelection(regions, current);
  if (!resolved) return undefined;
  const district = resolved.cityOption.districts[clamp(index, resolved.cityOption.districts.length)];
  if (!district) return resolved;
  return { ...resolved, district: district.name, districtIndex: clamp(index, resolved.cityOption.districts.length) };
}

function matchingIndex(options: readonly { name: string }[], name: string): number {
  if (!name) return 0;
  const index = options.findIndex((option) => option.name === name);
  return index < 0 ? 0 : index;
}

function clamp(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(Math.round(index), length - 1));
}
