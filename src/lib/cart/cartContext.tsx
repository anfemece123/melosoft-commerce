import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  customizationNotes: string | null;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(slug: string) {
  return `melosoft_cart_${slug}`;
}

function readFromStorage(slug: string): CartItem[] {
  try {
    const raw = sessionStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ storeSlug, children }: { storeSlug: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readFromStorage(storeSlug));

  useEffect(() => {
    sessionStorage.setItem(storageKey(storeSlug), JSON.stringify(items));
  }, [items, storeSlug]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  function addItem(incoming: Omit<CartItem, 'quantity'> & { quantity?: number }) {
    const qty = incoming.quantity ?? 1;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === incoming.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === incoming.productId ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { ...incoming, quantity: qty }];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clearCart() {
    setItems([]);
  }

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, updateQuantity, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
