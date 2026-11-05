// Simple cart store using localStorage (cart is purely client-side until checkout).
// On checkout we persist the order in the database.

import { useEffect, useState } from "react";

export type CartItem = {
  product_id: string;
  name: string;
  unit_price: number;
  image_url: string | null;
  quantity: number;
};

const KEY = "4k_shop_cart_v1";

function read(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => read());

  useEffect(() => {
    const sync = () => setItems(read());
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = (item: Omit<CartItem, "quantity">, qty = 1) => {
    const next = [...read()];
    const existing = next.find((i) => i.product_id === item.product_id);
    if (existing) existing.quantity += qty;
    else next.push({ ...item, quantity: qty });
    write(next);
  };

  const remove = (product_id: string) => {
    write(read().filter((i) => i.product_id !== product_id));
  };

  const setQty = (product_id: string, qty: number) => {
    const next = read()
      .map((i) => (i.product_id === product_id ? { ...i, quantity: Math.max(1, qty) } : i))
      .filter((i) => i.quantity > 0);
    write(next);
  };

  const clear = () => write([]);

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return { items, add, remove, setQty, clear, subtotal, count };
}
