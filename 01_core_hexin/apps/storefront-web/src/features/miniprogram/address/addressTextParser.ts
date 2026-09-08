import type { ChinaRegionTree, RegionArea, RegionCity, RegionProvince } from './chinaRegions';

export interface ParsedAddress {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
}

interface LocatedOption<T> {
  option: T;
  index: number;
  length: number;
}

const PHONE_PATTERN = /(?:\+?86[\s-]*)?(1[3-9](?:[\s-]*\d){9})/;
const MUNICIPALITIES = new Set(['北京市', '上海市', '天津市', '重庆市']);
const PROVINCE_SHORT_NAMES: Record<string, string> = {
  '内蒙古自治区': '内蒙古',
  '广西壮族自治区': '广西',
  '西藏自治区': '西藏',
  '宁夏回族自治区': '宁夏',
  '新疆维吾尔自治区': '新疆',
  '香港特别行政区': '香港',
  '澳门特别行政区': '澳门',
};

export function parseAddressText(source: string, regions: ChinaRegionTree): ParsedAddress {
  const normalized = normalizeSource(source);
  const phoneMatch = normalized.match(PHONE_PATTERN);
  const phone = phoneMatch?.[1]?.replace(/\D/g, '') ?? '';
  const phoneIndex = phoneMatch?.index ?? -1;
  const phoneText = phoneMatch?.[0] ?? '';
  let name = phoneIndex > 0 ? normalizeName(normalized.slice(0, phoneIndex)) : '';
  let addressText = removeOnce(normalized, phoneText);
  if (name) addressText = removeOnce(addressText, name);

  let located = locateRegion(addressText, regions);
  if (!name && located.firstIndex > 0) {
    name = normalizeName(addressText.slice(0, located.firstIndex));
    if (name) {
      addressText = removeOnce(addressText, name);
      located = locateRegion(addressText, regions);
    }
  }

  if (!name && phoneIndex === 0 && located.firstIndex < 0) {
    const firstToken = addressText.split(' ')[0] ?? '';
    if (looksLikeName(firstToken)) {
      name = firstToken;
      addressText = removeOnce(addressText, firstToken);
      located = locateRegion(addressText, regions);
    }
  }

  const detail = cleanDetail(
    located.lastIndex >= 0 ? addressText.slice(located.lastIndex) : addressText,
  );

  return {
    name,
    phone,
    province: located.province?.name ?? '',
    city: located.city?.name ?? '',
    district: located.district?.name ?? '',
    detail,
  };
}

export function missingAddressFields(address: ParsedAddress): string[] {
  const labels: Array<[keyof ParsedAddress, string]> = [
    ['name', '收货人'],
    ['phone', '手机号'],
    ['province', '省'],
    ['city', '市'],
    ['district', '区'],
    ['detail', '详细地址'],
  ];
  return labels.filter(([key]) => !address[key]).map(([, label]) => label);
}

function locateRegion(text: string, regions: ChinaRegionTree): {
  province?: RegionProvince;
  city?: RegionCity;
  district?: RegionArea;
  firstIndex: number;
  lastIndex: number;
} {
  const provinceMatch = locate(text, regions, 0, 'province');
  let province = provinceMatch?.option;
  let cityMatch = province
    ? locate(text, province.cities, (provinceMatch?.index ?? 0) + (provinceMatch?.length ?? 0), 'city')
    : locateCityAcrossChina(text, regions);
  let city = cityMatch?.option;

  if (!province && cityMatch) {
    province = regions.find((candidate) => candidate.cities.some((option) => option.code === cityMatch?.option.code));
  }

  if (province && MUNICIPALITIES.has(province.name) && !city) city = province.cities[0];

  let districtMatch = city
    ? locate(text, city.districts, cityMatch ? cityMatch.index + cityMatch.length : (provinceMatch?.index ?? 0) + (provinceMatch?.length ?? 0), 'district')
    : locateDistrictAcrossChina(text, regions);
  let district = districtMatch?.option;

  if (!city && districtMatch) {
    for (const provinceOption of regions) {
      const cityOption = provinceOption.cities.find((candidate) => candidate.districts.some((option) => option.code === districtMatch?.option.code));
      if (cityOption) {
        province = provinceOption;
        city = cityOption;
        break;
      }
    }
  }

  if (!province && city) {
    province = regions.find((candidate) => candidate.cities.some((option) => option.code === city?.code));
  }

  const matches = [provinceMatch, cityMatch, districtMatch].filter((match): match is LocatedOption<RegionArea> => Boolean(match));
  return {
    province,
    city,
    district,
    firstIndex: matches.length ? Math.min(...matches.map((match) => match.index)) : -1,
    lastIndex: matches.length ? Math.max(...matches.map((match) => match.index + match.length)) : -1,
  };
}

function locateCityAcrossChina(text: string, regions: ChinaRegionTree): LocatedOption<RegionCity> | undefined {
  return bestLocated(regions.flatMap((province) => province.cities.map((city) => locate(text, [city], 0, 'city'))));
}

function locateDistrictAcrossChina(text: string, regions: ChinaRegionTree): LocatedOption<RegionArea> | undefined {
  return bestLocated(regions.flatMap((province) => province.cities.flatMap((city) => city.districts.map((district) => locate(text, [district], 0, 'district')))));
}

function bestLocated<T>(matches: Array<LocatedOption<T> | undefined>): LocatedOption<T> | undefined {
  return matches.filter((match): match is LocatedOption<T> => Boolean(match)).sort(compareLocated)[0];
}

function locate<T extends { name: string }>(
  text: string,
  options: readonly T[],
  fromIndex: number,
  level: 'province' | 'city' | 'district',
): LocatedOption<T> | undefined {
  const matches: LocatedOption<T>[] = [];
  for (const option of options) {
    for (const alias of aliases(option.name, level)) {
      const index = text.indexOf(alias, fromIndex);
      if (index >= 0) matches.push({ option, index, length: alias.length });
    }
  }
  return matches.sort(compareLocated)[0];
}

function compareLocated<T>(left: LocatedOption<T>, right: LocatedOption<T>): number {
  return left.index - right.index || right.length - left.length;
}

function aliases(name: string, level: 'province' | 'city' | 'district'): string[] {
  const values = new Set([name]);
  if (level === 'province') {
    values.add(PROVINCE_SHORT_NAMES[name] ?? name.replace(/(?:特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市)$/u, ''));
  } else if (level === 'city') {
    values.add(name.replace(/(?:自治州|地区|盟|市)$/u, ''));
  } else {
    values.add(name.replace(/(?:自治县|自治旗|林区|特区|新区|区|县|市|旗)$/u, ''));
  }
  return [...values].filter((value) => value.length >= 2).sort((left, right) => right.length - left.length);
}

function normalizeSource(value: string): string {
  return value
    .replace(/[，,；;|\n\r\t]+/gu, ' ')
    .replace(/(?:收货人|收件人|联系人|姓名)\s*[:：]?/gu, ' ')
    .replace(/(?:联系电话|手机号码|手机号|电话)\s*[:：]?/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeName(value: string): string {
  const cleaned = value.replace(/(?:收货地址|地址)\s*[:：]?/gu, ' ').replace(/^[\s:：-]+|[\s:：-]+$/gu, '').trim();
  const candidate = cleaned.split(/\s+/u).at(-1) ?? '';
  return looksLikeName(candidate) ? candidate : '';
}

function looksLikeName(value: string): boolean {
  return /^[\p{Script=Han}A-Za-z·•]{2,12}$/u.test(value);
}

function cleanDetail(value: string): string {
  return value
    .replace(/^[\s,，:：-]+/u, '')
    .replace(/^(?:收货地址|详细地址|地址)\s*[:：]?\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function removeOnce(source: string, value: string): string {
  if (!value) return source;
  const index = source.indexOf(value);
  if (index < 0) return source;
  return `${source.slice(0, index)} ${source.slice(index + value.length)}`.replace(/\s+/gu, ' ').trim();
}
