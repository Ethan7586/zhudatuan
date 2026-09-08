export interface RegionArea {
  code: string;
  name: string;
}

export interface RegionCity extends RegionArea {
  districts: readonly RegionArea[];
}

export interface RegionProvince extends RegionArea {
  cities: readonly RegionCity[];
}

export type ChinaRegionTree = readonly RegionProvince[];

interface AreaListSource {
  province_list: Record<string, string>;
  city_list: Record<string, string>;
  county_list: Record<string, string>;
}

let regionTreePromise: Promise<ChinaRegionTree> | undefined;

export function loadChinaRegions(): Promise<ChinaRegionTree> {
  regionTreePromise ??= import('@vant/area-data').then(async ({ areaList }) => {
    // Let the sheet and its frost-dew placeholder paint before transforming
    // the complete district table on slower WebViews.
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
    return buildChinaRegionTree(areaList);
  });
  return regionTreePromise;
}

export function buildChinaRegionTree(source: AreaListSource): ChinaRegionTree {
  const citiesByProvince = new Map<string, RegionArea[]>();
  const districtsByCity = new Map<string, RegionArea[]>();

  for (const [code, name] of codeEntries(source.city_list)) {
    const provincePrefix = code.slice(0, 2);
    const cities = citiesByProvince.get(provincePrefix) ?? [];
    cities.push({ code, name });
    citiesByProvince.set(provincePrefix, cities);
  }

  for (const [code, name] of codeEntries(source.county_list)) {
    const cityPrefix = code.slice(0, 4);
    const districts = districtsByCity.get(cityPrefix) ?? [];
    districts.push({ code, name });
    districtsByCity.set(cityPrefix, districts);
  }

  return codeEntries(source.province_list).map(([code, name]) => ({
    code,
    name,
    cities: (citiesByProvince.get(code.slice(0, 2)) ?? []).map((city) => ({
      ...city,
      districts: districtsByCity.get(city.code.slice(0, 4)) ?? [],
    })),
  }));
}

function codeEntries(source: Record<string, string>): Array<[string, string]> {
  // Six-digit region codes are integer-like keys, so Object.entries already
  // yields numeric ascending order without a main-thread locale sort.
  return Object.entries(source);
}
