// Simple in-memory store with localStorage persistence
import { useState, useEffect } from "react";

export interface Product {
  id: string;
  name: string;
  category: "Phone Accessories" | "Internet Services" | "Printing Services" | "Other Services";
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  minStock: number;
  unit: string;
  lastPurchaseDate: string;
  salesCount: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  pin?: string;
  isTaxable: boolean;
  totalSpent: number;
  visitCount: number;
  createdAt: string;
}

export type PaymentMethod = "cash" | "mpesa" | "cash_mpesa" | "partial_debt";

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  mpesaAmount: number;
  status: "paid" | "partial" | "unpaid";
  createdAt: string;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  items: { productId: string; productName: string; quantity: number; unitCost: number; total: number }[];
  total: number;
  date: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

function loadData<T>(key: string, fallback: T): T {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch { return fallback; }
}

function saveData<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Seed data
const seedProducts: Product[] = [
  { id: "p1", name: "iPhone Screen Protector", category: "Phone Accessories", buyPrice: 100, sellPrice: 250, quantity: 50, minStock: 10, unit: "pcs", lastPurchaseDate: "2026-04-10", salesCount: 120 },
  { id: "p2", name: "USB-C Charger Cable", category: "Phone Accessories", buyPrice: 150, sellPrice: 350, quantity: 30, minStock: 8, unit: "pcs", lastPurchaseDate: "2026-04-08", salesCount: 85 },
  { id: "p3", name: "Phone Case Universal", category: "Phone Accessories", buyPrice: 200, sellPrice: 500, quantity: 25, minStock: 5, unit: "pcs", lastPurchaseDate: "2026-04-05", salesCount: 60 },
  { id: "p4", name: "WiFi Monthly Plan", category: "Internet Services", buyPrice: 2000, sellPrice: 3500, quantity: 999, minStock: 0, unit: "plan", lastPurchaseDate: "2026-04-01", salesCount: 45 },
  { id: "p5", name: "A4 Printing B&W (per page)", category: "Printing Services", buyPrice: 3, sellPrice: 10, quantity: 5000, minStock: 500, unit: "pages", lastPurchaseDate: "2026-04-12", salesCount: 2000 },
  { id: "p6", name: "A4 Printing Color (per page)", category: "Printing Services", buyPrice: 8, sellPrice: 20, quantity: 3000, minStock: 300, unit: "pages", lastPurchaseDate: "2026-04-12", salesCount: 800 },
  { id: "p7", name: "Earphones Wired", category: "Phone Accessories", buyPrice: 80, sellPrice: 200, quantity: 3, minStock: 10, unit: "pcs", lastPurchaseDate: "2026-03-20", salesCount: 5 },
  { id: "p8", name: "Laptop Repair Service", category: "Other Services", buyPrice: 0, sellPrice: 1500, quantity: 999, minStock: 0, unit: "service", lastPurchaseDate: "", salesCount: 12 },
];

const seedCustomers: Customer[] = [
  { id: "c1", name: "Walking Customer", phone: "", isTaxable: false, totalSpent: 0, visitCount: 0, createdAt: "2026-04-01" },
  { id: "c2", name: "John Kamau", phone: "0712345678", isTaxable: true, pin: "A001234567Z", totalSpent: 15000, visitCount: 8, createdAt: "2026-03-01" },
  { id: "c3", name: "Mary Wanjiku", phone: "0723456789", isTaxable: false, totalSpent: 8500, visitCount: 5, createdAt: "2026-03-15" },
];

const seedSuppliers: Supplier[] = [
  { id: "s1", name: "Nairobi Phone Supplies", phone: "0700111222" },
  { id: "s2", name: "Digital Print Hub", phone: "0700333444" },
];

const seedInvoices: Invoice[] = [
  { id: "inv1", invoiceNumber: "INV-0001", customerId: "c2", customerName: "John Kamau", items: [{ productId: "p1", productName: "iPhone Screen Protector", quantity: 2, unitPrice: 250, total: 500 }, { productId: "p4", productName: "WiFi Monthly Plan", quantity: 1, unitPrice: 3500, total: 3500 }], subtotal: 4000, tax: 640, total: 4640, paidAmount: 3000, balance: 1640, paymentMethod: "partial_debt", cashAmount: 2000, mpesaAmount: 1000, status: "partial", createdAt: "2026-04-10T09:30:00" },
  { id: "inv2", invoiceNumber: "INV-0002", customerId: "c3", customerName: "Mary Wanjiku", items: [{ productId: "p5", productName: "A4 Printing B&W (per page)", quantity: 50, unitPrice: 10, total: 500 }], subtotal: 500, tax: 0, total: 500, paidAmount: 500, balance: 0, paymentMethod: "mpesa", cashAmount: 0, mpesaAmount: 500, status: "paid", createdAt: "2026-04-12T14:00:00" },
  { id: "inv3", invoiceNumber: "INV-0003", customerId: "c2", customerName: "John Kamau", items: [{ productId: "p2", productName: "USB-C Charger Cable", quantity: 3, unitPrice: 350, total: 1050 }], subtotal: 1050, tax: 168, total: 1218, paidAmount: 1218, balance: 0, paymentMethod: "cash", cashAmount: 1218, mpesaAmount: 0, status: "paid", createdAt: "2026-04-13T10:00:00" },
];

const seedExpenses: Expense[] = [
  { id: "e1", category: "Electricity", description: "April electricity bill", amount: 3500, date: "2026-04-05" },
  { id: "e2", category: "Rent", description: "Shop rent April", amount: 25000, date: "2026-04-01" },
  { id: "e3", category: "Internet", description: "ISP subscription", amount: 5000, date: "2026-04-01" },
];

const seedPurchases: Purchase[] = [
  { id: "pu1", supplierId: "s1", supplierName: "Nairobi Phone Supplies", items: [{ productId: "p1", productName: "iPhone Screen Protector", quantity: 100, unitCost: 100, total: 10000 }], total: 10000, date: "2026-04-10" },
];

// Hook-based store
export function useStore() {
  const [products, setProducts] = useState<Product[]>(() => loadData("4k_products", seedProducts));
  const [customers, setCustomers] = useState<Customer[]>(() => loadData("4k_customers", seedCustomers));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadData("4k_invoices", seedInvoices));
  const [purchases, setPurchases] = useState<Purchase[]>(() => loadData("4k_purchases", seedPurchases));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadData("4k_expenses", seedExpenses));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadData("4k_suppliers", seedSuppliers));

  useEffect(() => { saveData("4k_products", products); }, [products]);
  useEffect(() => { saveData("4k_customers", customers); }, [customers]);
  useEffect(() => { saveData("4k_invoices", invoices); }, [invoices]);
  useEffect(() => { saveData("4k_purchases", purchases); }, [purchases]);
  useEffect(() => { saveData("4k_expenses", expenses); }, [expenses]);
  useEffect(() => { saveData("4k_suppliers", suppliers); }, [suppliers]);

  const addInvoice = (inv: Invoice) => {
    setInvoices(prev => [inv, ...prev]);
    // Reduce inventory
    inv.items.forEach(item => {
      setProducts(prev => prev.map(p => p.id === item.productId ? { ...p, quantity: Math.max(0, p.quantity - item.quantity), salesCount: p.salesCount + item.quantity } : p));
    });
    // Update customer
    setCustomers(prev => prev.map(c => c.id === inv.customerId ? { ...c, totalSpent: c.totalSpent + inv.paidAmount, visitCount: c.visitCount + 1 } : c));
  };

  const addPurchase = (pu: Purchase) => {
    setPurchases(prev => [pu, ...prev]);
    pu.items.forEach(item => {
      setProducts(prev => prev.map(p => p.id === item.productId ? { ...p, quantity: p.quantity + item.quantity, lastPurchaseDate: pu.date } : p));
    });
  };

  const addExpense = (ex: Expense) => setExpenses(prev => [ex, ...prev]);
  const addProduct = (p: Product) => setProducts(prev => [...prev, p]);
  const addCustomer = (c: Customer) => setCustomers(prev => [...prev, c]);
  const addSupplier = (s: Supplier) => setSuppliers(prev => [...prev, s]);

  const getNextInvoiceNumber = () => {
    const max = invoices.reduce((m, i) => {
      const n = parseInt(i.invoiceNumber.replace("INV-", ""));
      return n > m ? n : m;
    }, 0);
    return `INV-${String(max + 1).padStart(4, "0")}`;
  };

  return { products, customers, invoices, purchases, expenses, suppliers, setProducts, setCustomers, addInvoice, addPurchase, addExpense, addProduct, addCustomer, addSupplier, getNextInvoiceNumber };
}
