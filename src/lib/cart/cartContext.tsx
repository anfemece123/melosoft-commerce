/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ProductType, SelectedProductOptionItem } from '@/types/common.types';

export interface CartItem {
  lineId: string;
  productId: string;
  storeId: string;
  productSlug: string;
  productName: string;
  productType?: ProductType;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  customizationNotes: string | null;
  // Structured modifiers/adiciones — the source of truth for what gets
  // sent to the server (ids only matter there) and for showing extras +
  // their price in the cart. Optional/defaults to [] so carts persisted
  // before this field existed keep working (see normalizeCartItem).
  customizations: SelectedProductOptionItem[];
  // Stock metadata — optional so carts written before this field existed
  // keep working. trackInventory is only enforced when explicitly `true`;
  // unknown (undefined) never blocks a quantity change (soft UX guard only,
  // the backend remains the source of truth).
  trackInventory?: boolean;
  stock?: number | null;
  isAvailable?: boolean;
  // Variant metadata — optional for the same backward-compat reason. When
  // present, this line represents one specific variant of the product, and
  // is kept as a separate cart line from other variants/the base product.
  variantId?: string | null;
  variantLabel?: string | null;
  variantSku?: string | null;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  // Returns the resulting line item, or null if the item could not be added
  // (e.g. trackInventory is true and stock is 0).
  addItem: (item: Omit<CartItem, 'lineId' | 'quantity'> & { quantity?: number }) => CartItem | null;
  // Returns the quantity actually applied after clamping to available stock
  // (may be less than requested; 0 means the line was removed).
  updateQuantity: (lineId: string, quantity: number) => number;
  removeItem: (lineId: string) => void;
  removeItemsByProductIds: (productIds: string[]) => void;
  clearCart: () => void;
}

// Returns the maximum allowed quantity for an item, or null when there is no
// known ceiling (trackInventory is not confirmed true, or stock is unknown).
export function getMaxQuantity(item: Pick<CartItem, 'trackInventory' | 'stock'>): number | null {
  if (item.trackInventory === true && typeof item.stock === 'number') {
    return Math.max(0, Math.floor(item.stock));
  }
  return null;
}

export function isOutOfStock(
  item: Pick<CartItem, 'trackInventory' | 'stock' | 'isAvailable'>
): boolean {
  return item.isAvailable === false
    || (item.trackInventory === true && typeof item.stock === 'number' && item.stock <= 0);
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY_PREFIX = 'melosoft_cart_';

interface StoredCartState {
  items: CartItem[];
  updatedAt: number;
}

function storageKey(slug: string) {
  return `${STORAGE_KEY_PREFIX}${slug}`;
}

function legacySessionStorageKey(slug: string) {
  return `${STORAGE_KEY_PREFIX}${slug}`;
}

// Sorted by optionItemId so the same set of modifiers always serializes
// the same way regardless of selection order.
function serializeCustomizationsForLineId(customizations: SelectedProductOptionItem[]): string {
  return customizations
    .map((c) => c.optionItemId)
    .sort()
    .join(',');
}

function buildCartLineId(
  item: Pick<CartItem, 'productId' | 'unitPrice' | 'customizationNotes' | 'variantId' | 'customizations'>
): string {
  return JSON.stringify([
    item.productId,
    item.variantId ?? null,
    item.unitPrice,
    item.customizationNotes?.trim() ?? '',
    serializeCustomizationsForLineId(item.customizations),
  ]);
}

function isSelectedProductOptionItem(value: unknown): value is SelectedProductOptionItem {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<SelectedProductOptionItem>;
  return (
    typeof c.optionGroupId === 'string' &&
    typeof c.optionGroupName === 'string' &&
    typeof c.optionItemId === 'string' &&
    typeof c.optionItemLabel === 'string' &&
    typeof c.priceDelta === 'number'
  );
}

function normalizeCustomizations(raw: unknown): SelectedProductOptionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSelectedProductOptionItem);
}

function normalizeCartItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<CartItem>;
  if (
    typeof candidate.productId !== 'string' ||
    typeof candidate.productSlug !== 'string' ||
    typeof candidate.productName !== 'string' ||
    typeof candidate.unitPrice !== 'number' ||
    typeof candidate.quantity !== 'number'
  ) {
    return null;
  }

  const customizationNotes =
    typeof candidate.customizationNotes === 'string' && candidate.customizationNotes.trim().length > 0
      ? candidate.customizationNotes.trim()
      : null;
  const customizations = normalizeCustomizations(candidate.customizations);

  const normalized: CartItem = {
    lineId: typeof candidate.lineId === 'string' && candidate.lineId.length > 0
      ? candidate.lineId
      : buildCartLineId({
          productId: candidate.productId,
          unitPrice: candidate.unitPrice,
          customizationNotes,
          variantId: typeof candidate.variantId === 'string' ? candidate.variantId : null,
          customizations,
        }),
    productId: candidate.productId,
    // Carts persisted before this field existed won't have it — default to
    // '' rather than dropping the item; it's metadata only, isolation across
    // stores is already guaranteed by the per-storeSlug Provider/storage key.
    storeId: typeof candidate.storeId === 'string' ? candidate.storeId : '',
    productSlug: candidate.productSlug,
    productName: candidate.productName,
    productType: candidate.productType === 'menu_item'
      || candidate.productType === 'physical_product'
      || candidate.productType === 'service'
      ? candidate.productType
      : undefined,
    imageUrl: typeof candidate.imageUrl === 'string' ? candidate.imageUrl : null,
    unitPrice: candidate.unitPrice,
    quantity: Number.isFinite(candidate.quantity) && candidate.quantity > 0 ? Math.floor(candidate.quantity) : 1,
    customizationNotes,
    customizations,
    trackInventory: typeof candidate.trackInventory === 'boolean' ? candidate.trackInventory : undefined,
    stock: typeof candidate.stock === 'number' ? candidate.stock : null,
    isAvailable: typeof candidate.isAvailable === 'boolean' ? candidate.isAvailable : undefined,
    variantId: typeof candidate.variantId === 'string' ? candidate.variantId : null,
    variantLabel: typeof candidate.variantLabel === 'string' ? candidate.variantLabel : null,
    variantSku: typeof candidate.variantSku === 'string' ? candidate.variantSku : null,
  };

  return normalized;
}

function normalizeStoredItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map((item) => normalizeCartItem(item))
    .filter((item): item is CartItem => item !== null);

  const merged = new Map<string, CartItem>();
  for (const item of normalized) {
    const existing = merged.get(item.lineId);
    if (existing) {
      merged.set(item.lineId, { ...existing, quantity: existing.quantity + item.quantity });
      continue;
    }
    merged.set(item.lineId, item);
  }

  return Array.from(merged.values());
}

function readStoredCartState(slug: string): StoredCartState {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (raw) {
      const parsed = JSON.parse(raw) as StoredCartState | CartItem[];
      if (Array.isArray(parsed)) {
        return { items: normalizeStoredItems(parsed), updatedAt: 0 };
      }
      return {
        items: normalizeStoredItems(parsed.items),
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      };
    }
  } catch {
    // fall through to legacy session storage
  }

  try {
    const raw = sessionStorage.getItem(legacySessionStorageKey(slug));
    if (!raw) {
      return { items: [], updatedAt: 0 };
    }

    return {
      items: normalizeStoredItems(JSON.parse(raw) as CartItem[]),
      updatedAt: 0,
    };
  } catch {
    return { items: [], updatedAt: 0 };
  }
}

function writeStoredCartState(slug: string, state: StoredCartState) {
  localStorage.setItem(storageKey(slug), JSON.stringify(state));
}

function buildStoredCartState(items: CartItem[]): StoredCartState {
  return {
    items,
    updatedAt: Date.now(),
  };
}

function removeLegacySessionState(slug: string) {
  try {
    sessionStorage.removeItem(legacySessionStorageKey(slug));
  } catch {
    // ignore storage failures
  }
}

export function CartProvider({ storeSlug, children }: { storeSlug: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStoredCartState(storeSlug).items);
  const lastUpdatedAtRef = useRef(readStoredCartState(storeSlug).updatedAt);

  useEffect(() => {
    const nextState = buildStoredCartState(items);
    writeStoredCartState(storeSlug, nextState);
    lastUpdatedAtRef.current = nextState.updatedAt;
    removeLegacySessionState(storeSlug);
  }, [items, storeSlug]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.storageArea !== localStorage || event.key !== storageKey(storeSlug)) {
        return;
      }

      const nextState = readStoredCartState(storeSlug);
      if (nextState.updatedAt < lastUpdatedAtRef.current) {
        return;
      }

      lastUpdatedAtRef.current = nextState.updatedAt;
      setItems(nextState.items);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storeSlug]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // addItem/updateQuantity compute their return value from `items` (this
  // render's state) rather than from inside the setItems updater — updater
  // functions aren't guaranteed to run before the call returns, so mutating
  // a local variable from within one and reading it right after is unsafe.
  // Reading `items` directly is correct for the normal one-click-at-a-time
  // usage in this app (a re-render always happens between clicks); the
  // functional setItems form below is still used for the actual write so the
  // state update itself stays correct even under batching.
  const addItem = useCallback((incoming: Omit<CartItem, 'lineId' | 'quantity'> & { quantity?: number }): CartItem | null => {
    const qty = incoming.quantity ?? 1;
    const normalizedIncoming = {
      ...incoming,
      customizationNotes: incoming.customizationNotes?.trim() || null,
    };
    const lineId = buildCartLineId({
      productId: normalizedIncoming.productId,
      unitPrice: normalizedIncoming.unitPrice,
      customizationNotes: normalizedIncoming.customizationNotes,
      variantId: normalizedIncoming.variantId ?? null,
      customizations: normalizedIncoming.customizations,
    });
    const max = getMaxQuantity(normalizedIncoming);
    const existing = items.find((i) => i.lineId === lineId);

    if (normalizedIncoming.isAvailable === false) {
      // A manually sold-out item stays visible in restaurant menus, but can
      // never enter the cart.
      return null;
    }

    if (!existing && max !== null && max <= 0) {
      // Out of stock — nothing to add.
      return null;
    }

    const result: CartItem = existing
      ? {
          ...existing,
          ...normalizedIncoming,
          lineId,
          quantity: max !== null
            ? Math.min(existing.quantity + qty, Math.max(max, existing.quantity))
            : existing.quantity + qty,
        }
      : {
          ...normalizedIncoming,
          lineId,
          quantity: Math.max(1, max !== null ? Math.min(qty, max) : qty),
        };

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.lineId === lineId);
      if (idx === -1) return [...prev, result];
      return prev.map((i) => (i.lineId === lineId ? result : i));
    });

    return result;
  }, [items]);

  const updateQuantity = useCallback((lineId: string, quantity: number): number => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.lineId !== lineId));
      return 0;
    }
    const current = items.find((i) => i.lineId === lineId);
    if (current?.isAvailable === false) return current.quantity;
    const max = current ? getMaxQuantity(current) : null;
    const applied = max !== null ? Math.min(quantity, Math.max(max, 1)) : quantity;

    setItems((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, quantity: applied } : i)));
    return applied;
  }, [items]);

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  }, []);

  const removeItemsByProductIds = useCallback((productIds: string[]) => {
    if (productIds.length === 0) return;
    const ids = new Set(productIds);
    setItems((prev) => prev.filter((i) => !ids.has(i.productId)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <CartContext.Provider value={{
      items,
      totalItems,
      totalPrice,
      addItem,
      updateQuantity,
      removeItem,
      removeItemsByProductIds,
      clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
