import { useEffect, useMemo, useState } from 'react';
import { useMall } from '../../context/MallContext';
import { expandSearchKeyword, normalizeText, getGenericCategoryTerms } from './categoryCatalogSearch';
import type { Product, ProductItemType } from '../../types';

export function useCategoryCatalog() {
  const mall = useMall();
  const { routeParams, products, showToast } = mall;
  const [selectedCategory, setSelectedCategory] = useState(routeParams.categoryId || 'all');
  const [selectedItemType, setSelectedItemType] = useState<ProductItemType | 'all'>((routeParams.itemType as ProductItemType) || 'all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedTaxonomyL1, setSelectedTaxonomyL1] = useState('all');
  const [selectedTaxonomyL2, setSelectedTaxonomyL2] = useState('all');
  const [selectedTaxonomyL3, setSelectedTaxonomyL3] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [keyword, setKeyword] = useState(routeParams.keyword || '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'default' | 'sales' | 'priceAsc' | 'priceDesc' | 'newest' | 'rating'>('default');
  const [compareList, setCompareList] = useState<Product[]>([]);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    const syncedCategory = routeParams.categoryId || 'all';
    const syncedType = (routeParams.itemType as ProductItemType) || 'all';
    const syncedKeyword = routeParams.keyword || '';
    setSelectedCategory((previous) => (previous === syncedCategory ? previous : syncedCategory));
    setSelectedItemType((previous) => (previous === syncedType ? previous : syncedType));
    setKeyword((previous) => (previous === syncedKeyword ? previous : syncedKeyword));
    setSelectedTaxonomyL1('all');
    setSelectedTaxonomyL2('all');
    setSelectedTaxonomyL3('all');
    setCurrentPageNum(1);
  }, [routeParams.categoryId, routeParams.itemType, routeParams.keyword]);

  const resetToFirstPage = () => setCurrentPageNum(1);
  const setCategory = (nextCategory: string) => {
    setSelectedCategory(nextCategory);
    setSelectedTaxonomyL1('all');
    setSelectedTaxonomyL2('all');
    setSelectedTaxonomyL3('all');
    setCurrentPageNum(1);
  };
  const setItemType = (nextType: ProductItemType | 'all') => {
    setSelectedItemType(nextType);
    setCurrentPageNum(1);
  };
  const setSupplier = (nextSupplier: string) => {
    setSelectedSupplier(nextSupplier);
    setCurrentPageNum(1);
  };
  const setAccount = (nextAccount: string) => {
    setSelectedAccount(nextAccount);
    setCurrentPageNum(1);
  };
  const setTaxonomyL1 = (nextTaxonomy: string) => {
    setSelectedTaxonomyL1(nextTaxonomy);
    setSelectedTaxonomyL2('all');
    setSelectedTaxonomyL3('all');
    setCurrentPageNum(1);
  };
  const setTaxonomyL2 = (nextTaxonomy: string) => {
    setSelectedTaxonomyL2(nextTaxonomy);
    setSelectedTaxonomyL3('all');
    setCurrentPageNum(1);
  };
  const setTaxonomyL3 = (nextTaxonomy: string) => {
    setSelectedTaxonomyL3(nextTaxonomy);
    setCurrentPageNum(1);
  };
  const setBrand = (nextBrand: string) => {
    setSelectedBrand(nextBrand);
    setCurrentPageNum(1);
  };
  const setKeywordWithReset = (nextKeyword: string) => {
    setKeyword(nextKeyword);
    setCurrentPageNum(1);
  };
  const setMinPriceWithReset = (next: string) => {
    setMinPrice(next);
    setCurrentPageNum(1);
  };
  const setMaxPriceWithReset = (next: string) => {
    setMaxPrice(next);
    setCurrentPageNum(1);
  };
  const setInStockOnlyWithReset = (next: boolean) => {
    setInStockOnly(next);
    setCurrentPageNum(1);
  };

  const availableTaxonomyL1 = useMemo(() => {
    const values = new Set<string>(['all']);
    products.forEach((product) => {
      const inCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
      if (inCategory && product.taxonomy?.l1) {
        values.add(product.taxonomy.l1);
      }
    });
    return Array.from(values);
  }, [products, selectedCategory]);

  const availableTaxonomyL2 = useMemo(() => {
    const values = new Set<string>(['all']);
    products.forEach((product) => {
      const inCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
      const inL1 = selectedTaxonomyL1 === 'all' || product.taxonomy?.l1 === selectedTaxonomyL1;
      if (inCategory && inL1 && product.taxonomy?.l2) {
        values.add(product.taxonomy.l2);
      }
    });
    return Array.from(values);
  }, [products, selectedCategory, selectedTaxonomyL1]);

  const availableTaxonomyL3 = useMemo(() => {
    const values = new Set<string>(['all']);
    products.forEach((product) => {
      const inCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
      const inL1 = selectedTaxonomyL1 === 'all' || product.taxonomy?.l1 === selectedTaxonomyL1;
      const inL2 = selectedTaxonomyL2 === 'all' || product.taxonomy?.l2 === selectedTaxonomyL2;
      if (inCategory && inL1 && inL2 && product.taxonomy?.l3) {
        values.add(product.taxonomy.l3);
      }
    });
    return Array.from(values);
  }, [products, selectedCategory, selectedTaxonomyL1, selectedTaxonomyL2]);

  useEffect(() => {
    if (selectedTaxonomyL1 !== 'all' && !availableTaxonomyL1.includes(selectedTaxonomyL1)) {
      setSelectedTaxonomyL1('all');
    }
  }, [selectedTaxonomyL1, availableTaxonomyL1]);

  useEffect(() => {
    if (selectedTaxonomyL2 !== 'all' && !availableTaxonomyL2.includes(selectedTaxonomyL2)) {
      setSelectedTaxonomyL2('all');
    }
  }, [selectedTaxonomyL2, availableTaxonomyL2]);

  useEffect(() => {
    if (selectedTaxonomyL3 !== 'all' && !availableTaxonomyL3.includes(selectedTaxonomyL3)) {
      setSelectedTaxonomyL3('all');
    }
  }, [selectedTaxonomyL3, availableTaxonomyL3]);

  const filteredProducts = useMemo(() => {
    const effectiveKeyword = (keyword || routeParams.keyword || '').trim().toLowerCase();
    const searchTerms = expandSearchKeyword(effectiveKeyword);
    const categoryKeyword = Object.entries(getGenericCategoryTerms()).find(([, terms]) => terms.includes(effectiveKeyword))?.[0];

    const result = products.filter((product) => {
      const searchableText = normalizeText(`${product.title} ${product.subtitle} ${product.brand} ${product.categoryName} ${product.supplierName}`);
      const taxonomyText = normalizeText(`${product.taxonomy?.l1 ?? ''} ${product.taxonomy?.l2 ?? ''} ${product.taxonomy?.l3 ?? ''}`);

      const matchesKeyword = !effectiveKeyword ? true : searchTerms.some((term) => searchableText.includes(term) || taxonomyText.includes(term) || categoryKeyword === product.categoryId);

      if (!matchesKeyword) return false;
      if (selectedCategory !== 'all' && product.categoryId !== selectedCategory) return false;
      if (selectedTaxonomyL1 !== 'all' && product.taxonomy?.l1 !== selectedTaxonomyL1) return false;
      if (selectedTaxonomyL2 !== 'all' && product.taxonomy?.l2 !== selectedTaxonomyL2) return false;
      if (selectedTaxonomyL3 !== 'all' && product.taxonomy?.l3 !== selectedTaxonomyL3) return false;
      if (selectedItemType !== 'all' && product.itemType !== selectedItemType) return false;
      if (selectedSupplier !== 'all' && product.supplierType !== selectedSupplier) return false;
      if (selectedAccount !== 'all' && !product.allowedAccounts.includes(selectedAccount as 'welfare' | 'meal' | 'wechat' | 'cash')) return false;
      if (minPrice && product.priceWelfare < Number(minPrice)) return false;
      if (maxPrice && product.priceWelfare > Number(maxPrice)) return false;
      return !inStockOnly || product.stock > 0;
    });

    return [...result].sort((left, right) => {
      if (sortBy === 'sales') return right.salesCount - left.salesCount;
      if (sortBy === 'priceAsc') return left.priceWelfare - right.priceWelfare;
      if (sortBy === 'priceDesc') return right.priceWelfare - left.priceWelfare;
      if (sortBy === 'newest') {
        return Number(Boolean(right.isNewArrival)) - Number(Boolean(left.isNewArrival));
      }
      if (sortBy === 'rating') {
        if (right.rating !== left.rating) return right.rating - left.rating;
        return right.reviewCount - left.reviewCount;
      }
      return Number(Boolean(right.isEnterpriseExclusive)) - Number(Boolean(left.isEnterpriseExclusive));
    });
  }, [keyword, routeParams.keyword, selectedCategory, selectedTaxonomyL1, selectedTaxonomyL2, selectedTaxonomyL3, selectedItemType, selectedSupplier, selectedAccount, minPrice, maxPrice, inStockOnly, sortBy, products]);

  const availableBrands = useMemo(() => Array.from(new Set(filteredProducts.map((product) => product.brand))), [filteredProducts]);
  const finalProducts = useMemo(() => (selectedBrand === 'all' ? filteredProducts : filteredProducts.filter((product) => product.brand === selectedBrand)), [filteredProducts, selectedBrand]);
  const totalPages = Math.ceil(finalProducts.length / pageSize) || 1;
  const paginatedProducts = finalProducts.slice((currentPageNum - 1) * pageSize, currentPageNum * pageSize);

  const activeFilterCount = [
    selectedCategory !== 'all',
    selectedTaxonomyL1 !== 'all',
    selectedTaxonomyL2 !== 'all',
    selectedTaxonomyL3 !== 'all',
    selectedItemType !== 'all',
    selectedSupplier !== 'all',
    selectedAccount !== 'all',
    selectedBrand !== 'all',
    inStockOnly,
    minPrice !== '',
    maxPrice !== '',
  ].filter(Boolean).length;
  const isPriceRangeInvalid = Boolean(minPrice && maxPrice && Number(minPrice) > Number(maxPrice));

  const normalizeSelectedPage = (nextTotalPages: number) => {
    if (nextTotalPages === 0) {
      return 1;
    }
    setCurrentPageNum((previous) => Math.min(Math.max(1, previous), nextTotalPages));
  };
  useEffect(() => {
    normalizeSelectedPage(totalPages);
  }, [totalPages]);

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedTaxonomyL1('all');
    setSelectedTaxonomyL2('all');
    setSelectedTaxonomyL3('all');
    setSelectedItemType('all');
    setSelectedSupplier('all');
    setSelectedAccount('all');
    setKeyword('');
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSelectedBrand('all');
    setSortBy('default');
    setCurrentPageNum(1);
  };
  const toggleCompare = (product: Product) => {
    if (compareList.some((item) => item.id === product.id)) {
      setCompareList((items) => items.filter((item) => item.id !== product.id));
      return;
    }
    if (compareList.length >= 3) {
      showToast('对比最多支持 3 件商品，请先移除后再继续', 'warning');
      return;
    }
    setCompareList((items) => [...items, product]);
  };

  return {
    ...mall,
    selectedCategory,
    setSelectedCategory: setCategory,
    selectedTaxonomyL1,
    setSelectedTaxonomyL1: setTaxonomyL1,
    selectedTaxonomyL2,
    setSelectedTaxonomyL2: setTaxonomyL2,
    selectedTaxonomyL3,
    setSelectedTaxonomyL3: setTaxonomyL3,
    availableTaxonomyL1,
    availableTaxonomyL2,
    availableTaxonomyL3,
    selectedItemType,
    setSelectedItemType: setItemType,
    selectedSupplier,
    setSelectedSupplier: setSupplier,
    selectedAccount,
    setSelectedAccount: setAccount,
    keyword,
    setKeyword: setKeywordWithReset,
    minPrice,
    setMinPrice: setMinPriceWithReset,
    maxPrice,
    setMaxPrice: setMaxPriceWithReset,
    inStockOnly,
    setInStockOnly: setInStockOnlyWithReset,
    selectedBrand,
    setSelectedBrand: setBrand,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    compareList,
    setCompareList,
    currentPageNum,
    setCurrentPageNum,
    pageSize,
    availableBrands,
    finalProducts,
    totalPages,
    paginatedProducts,
    isPriceRangeInvalid,
    resetToFirstPage,
    resetFilters,
    toggleCompare,
    activeFilterCount,
  };
}

export type CategoryCatalogModel = ReturnType<typeof useCategoryCatalog>;
