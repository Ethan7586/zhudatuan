import type { CartItem, DeliveryAddress, Product, ProductItemType } from '../types';
import { MOCK_PRODUCTS } from '../mock/data';
import { MallState, STORAGE_KEYS } from './mallState';

export class MallCatalogCart extends MallState {
  // --- Product Search, Query & Filter ---
  public getProducts(params?: {
    keyword?: string;
    categoryId?: string;
    subCategoryName?: string;
    itemType?: ProductItemType | 'all';
    supplierType?: string;
    accountType?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    sortBy?: 'default' | 'sales' | 'priceAsc' | 'priceDesc' | 'newest';
  }): Product[] {
    let list = [...MOCK_PRODUCTS];

    if (!params) return list;

    if (params.keyword && params.keyword.trim() !== '') {
      const kw = params.keyword.trim().toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(kw) || p.subtitle.toLowerCase().includes(kw) || p.brand.toLowerCase().includes(kw) || p.categoryName.toLowerCase().includes(kw) || p.tags.some((t) => t.toLowerCase().includes(kw))
      );
    }

    if (params.categoryId && params.categoryId !== 'all') {
      list = list.filter((p) => p.categoryId === params.categoryId);
    }

    if (params.itemType && params.itemType !== 'all') {
      list = list.filter((p) => p.itemType === params.itemType);
    }

    if (params.supplierType && params.supplierType !== 'all') {
      list = list.filter((p) => p.supplierType === params.supplierType);
    }

    if (params.accountType && params.accountType !== 'all') {
      list = list.filter((p) => p.allowedAccounts.includes(params.accountType as any));
    }

    if (params.minPrice !== undefined && !isNaN(params.minPrice)) {
      list = list.filter((p) => p.priceWelfare >= params.minPrice!);
    }

    if (params.maxPrice !== undefined && !isNaN(params.maxPrice)) {
      list = list.filter((p) => p.priceWelfare <= params.maxPrice!);
    }

    if (params.inStockOnly) {
      list = list.filter((p) => p.stock > 0);
    }

    if (params.sortBy) {
      switch (params.sortBy) {
        case 'sales':
          list.sort((a, b) => b.salesCount - a.salesCount);
          break;
        case 'priceAsc':
          list.sort((a, b) => a.priceWelfare - b.priceWelfare);
          break;
        case 'priceDesc':
          list.sort((a, b) => b.priceWelfare - a.priceWelfare);
          break;
        case 'newest':
          list.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0));
          break;
      }
    }

    return list;
  }

  public getProductById(id: string): Product | undefined {
    return MOCK_PRODUCTS.find((p) => p.id === id);
  }

  // --- Cart Management ---
  public getCart(): CartItem[] {
    return [...this.cart];
  }

  public addToCart(product: Product, quantity = 1, selectedSpec: Record<string, string> = {}): CartItem[] {
    const existingIndex = this.cart.findIndex((item) => item.productId === product.id && JSON.stringify(item.selectedSpec) === JSON.stringify(selectedSpec));

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({
        id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id,
        product,
        quantity,
        selectedSpec,
        selected: true,
        distributorId: this.user.distributorId,
      });
    }

    this.saveCart();
    return this.getCart();
  }

  public updateCartQuantity(cartItemId: string, quantity: number): CartItem[] {
    if (quantity <= 0) {
      return this.removeCartItem(cartItemId);
    }
    const item = this.cart.find((i) => i.id === cartItemId);
    if (item) {
      item.quantity = quantity;
      this.saveCart();
    }
    return this.getCart();
  }

  public toggleCartItemSelected(cartItemId: string): CartItem[] {
    const item = this.cart.find((i) => i.id === cartItemId);
    if (item) {
      item.selected = !item.selected;
      this.saveCart();
    }
    return this.getCart();
  }

  public toggleSelectAllCart(selected: boolean): CartItem[] {
    this.cart.forEach((item) => {
      item.selected = selected;
    });
    this.saveCart();
    return this.getCart();
  }

  public removeCartItem(cartItemId: string): CartItem[] {
    this.cart = this.cart.filter((i) => i.id !== cartItemId);
    this.saveCart();
    return this.getCart();
  }

  public clearSelectedCartItems(): void {
    this.cart = this.cart.filter((i) => !i.selected);
    this.saveCart();
  }

  private saveCart(): void {
    this.saveToStorage(this.getScopedKey(STORAGE_KEYS.CART), this.cart);
  }

  // --- Favorites ---
  public getFavorites(): string[] {
    return [...this.favorites];
  }

  public toggleFavorite(productId: string): boolean {
    if (this.favorites.includes(productId)) {
      this.favorites = this.favorites.filter((id) => id !== productId);
    } else {
      this.favorites.push(productId);
    }
    this.saveToStorage(this.getScopedKey(STORAGE_KEYS.FAVORITES), this.favorites);
    return this.favorites.includes(productId);
  }

  // --- Address Management ---
  public getAddresses(): DeliveryAddress[] {
    return [...this.addresses];
  }

  public addAddress(address: Omit<DeliveryAddress, 'id'>): DeliveryAddress[] {
    const newAddr: DeliveryAddress = {
      ...address,
      id: `addr_${Date.now()}`,
    };
    if (newAddr.isDefault) {
      this.addresses.forEach((a) => (a.isDefault = false));
    }
    this.addresses.unshift(newAddr);
    this.saveToStorage(this.getScopedKey(STORAGE_KEYS.ADDRESSES), this.addresses);
    return this.getAddresses();
  }
}
