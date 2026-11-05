import { useState, useMemo, useCallback } from "react";
import { useProductWithStock } from "@/hooks/useProducts";
import { useCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import { useCreateInvoice, useInvoices } from "@/hooks/useInvoices";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAuth } from "@/hooks/useAuth";
import { getCustomerCreditStatus } from "@/lib/customerStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, AlertTriangle, UserPlus, Ban, Smartphone, User, Sparkles } from "lucide-react";
import { useWalkinHistory, normalizePhone, findWalkinAccount, WALKIN_CUSTOMER_NAME } from "@/hooks/useWalkins";
import OverpaymentDialog from "@/components/OverpaymentDialog";
import WalkinConvertDialog from "@/components/WalkinConvertDialog";
import { StockSearchAutocomplete } from "@/components/StockSearchAutocomplete";
import StkPushDialog from "@/components/StkPushDialog";
import { toast } from "sonner";

type PaymentMethod = "cash" | "mpesa" | "cash_mpesa" | "partial_debt";

interface LineItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  original_price: number;
  total: number;
  stock: number;
  floor_price: number;
  tax_category: string;
  /** Per-product VAT % override; null = use system default */
  vat_rate: number | null;
}

export default function NewInvoice() {
  const { data: products = [] } = useProductWithStock();
  const { data: customers = [] } = useCustomers();
  const { data: allInvoices = [] } = useInvoices();
  const { data: settings = {} } = useSystemSettings();
  const createInvoice = useCreateInvoice();
  const createCustomer = useCreateCustomer();
  const { user } = useAuth();

  const etimsEnabled = settings.etims_enabled === "true";
  const vatRate = Number(settings.default_tax_rate || 16) / 100;

  // Customer state
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing" | "new">("walkin");
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [showConvert, setShowConvert] = useState(false);
  const { data: walkinHistory } = useWalkinHistory(walkinPhone);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [custPin, setCustPin] = useState("");
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  // Product state
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Invoice state
  const [items, setItems] = useState<LineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashAmount, setCashAmount] = useState(0);
  const [mpesaAmount, setMpesaAmount] = useState(0);

  // STK Push (M-Pesa) state
  const [stkOpen, setStkOpen] = useState(false);
  const [stkData, setStkData] = useState<{ invoiceId: string; invoiceNumber?: string; customerId: string | null; customerName?: string; phone: string; amount: number } | null>(null);

  // Overpayment state
  const [overpayOpen, setOverpayOpen] = useState(false);
  const [overpayData, setOverpayData] = useState<{ invoiceId: string; invoiceNumber?: string; customerId: string; customerName: string; overpaid: number; cash: number; mpesa: number } | null>(null);


  // Customer search (fuzzy)
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.filter(c => c.customer_type !== "walk_in").slice(0, 10);
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.customer_type !== "walk_in" && (
        c.name.toLowerCase().includes(q) ||
        c.customer_code.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.kra_pin && c.kra_pin.toLowerCase().includes(q))
      )
    ).slice(0, 10);
  }, [customerSearch, customers]);

  // Product search (fuzzy)
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [productSearch, products]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerHasPin = !!custPin || !!selectedCustomer?.kra_pin;

  // VAT logic: only apply if eTIMS is on. Per-product vat_rate overrides default.
  const calculateItemVAT = useCallback((item: LineItem) => {
    if (!etimsEnabled) return 0;
    if (item.tax_category === "exempt" || item.tax_category === "zero_rated") return 0;
    const effective = item.vat_rate !== null && item.vat_rate !== undefined
      ? Number(item.vat_rate) / 100
      : vatRate;
    return item.total * effective;
  }, [etimsEnabled, vatRate]);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tax = etimsEnabled ? items.reduce((s, i) => s + calculateItemVAT(i), 0) : 0;
  const total = subtotal + tax;

  const paidAmount = paymentMethod === "cash" ? cashAmount
    : paymentMethod === "mpesa" ? mpesaAmount
    : cashAmount + mpesaAmount;
  const balance = Math.max(0, total - paidAmount);

  // Credit limit check
  const creditWarning = useMemo(() => {
    if (!selectedCustomer) return null;
    const debtLimit = Number(selectedCustomer.debt_limit);
    if (debtLimit <= 0) return null;
    const currentDebt = Number(selectedCustomer.current_balance);
    const newTotal = currentDebt + balance;
    if (newTotal > debtLimit) {
      return `Credit limit exceeded! Limit: KES ${debtLimit.toLocaleString()}, Current debt: KES ${currentDebt.toLocaleString()}, New balance would be: KES ${newTotal.toLocaleString()}`;
    }
    return null;
  }, [selectedCustomer, balance]);

  // Suspension status (over credit limit OR overdue past terms OR manually suspended)
  const creditStatus = useMemo(
    () => (selectedCustomer ? getCustomerCreditStatus(selectedCustomer as any, allInvoices as any) : null),
    [selectedCustomer, allInvoices],
  );
  // A credit (debt) invoice for a suspended customer must be held for admin approval
  const needsApproval = !!creditStatus?.suspended && balance > 0;

  const selectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const c = customers.find(c => c.id === id);
    if (c) setCustomerSearch(c.name);
    setShowCustDropdown(false);
    setCustomerMode("existing");
  };

  const addItem = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const isService = (prod as any).is_service === true;
    const existing = items.find(i => i.product_id === productId);
    if (existing) {
      const nextQty = existing.quantity + 1;
      if (!isService && nextQty > prod.stock_on_hand) {
        toast.error(`Only ${prod.stock_on_hand} ${prod.unit} of ${prod.name} in stock`);
        return;
      }
      setItems(items.map(i => i.product_id === productId
        ? { ...i, quantity: nextQty, total: nextQty * i.unit_price }
        : i));
    } else {
      if (!isService && prod.stock_on_hand <= 0) {
        toast.error(`${prod.name} is out of stock`);
        return;
      }
      const price = Number(prod.base_sell_price);
      setItems([...items, {
        product_id: prod.id,
        name: prod.name,
        quantity: 1,
        unit_price: price,
        original_price: price,
        total: price,
        stock: isService ? Number.POSITIVE_INFINITY : prod.stock_on_hand,
        floor_price: Number(prod.floor_price),
        tax_category: (prod as any).tax_category || "standard",
        vat_rate: (prod as any).vat_rate ?? null,
      }]);
    }
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const updateItemQty = (productId: string, qty: number) => {
    if (qty <= 0) { setItems(items.filter(i => i.product_id !== productId)); return; }
    const item = items.find(i => i.product_id === productId);
    if (item && Number.isFinite(item.stock) && qty > item.stock) {
      toast.error(`Only ${item.stock} units of ${item.name} in stock`);
      return;
    }
    setItems(items.map(i => i.product_id === productId ? { ...i, quantity: qty, total: qty * i.unit_price } : i));
  };

  const updateItemPrice = (productId: string, price: number) => {
    const item = items.find(i => i.product_id === productId);
    if (item && price < item.floor_price) {
      toast.error(`Price cannot be below floor price KES ${item.floor_price}`);
      return;
    }
    setItems(items.map(i => i.product_id === productId ? { ...i, unit_price: price, total: i.quantity * price } : i));
  };

  const removeItem = (productId: string) => setItems(items.filter(i => i.product_id !== productId));

  // The single shared "WALKIN-CUSTOMER" ledger account (no record per walk-in).
  const getWalkinAccountId = async (): Promise<string> => {
    const walkin = findWalkinAccount(customers as any);
    if (walkin) return (walkin as any).id;
    const w = await createCustomer.mutateAsync({ name: WALKIN_CUSTOMER_NAME, customer_type: "walk_in" });
    return w.id;
  };

  // Resolve (or create) the customer for this sale, returning its id.
  const resolveCustomerId = async (): Promise<string | null> => {
    let customerId = selectedCustomerId;
    if (customerMode === "new") {
      if (!newCustName.trim()) { toast.error("Enter customer name"); return null; }
      const newCust = await createCustomer.mutateAsync({
        name: newCustName,
        phone: newCustPhone || undefined,
        kra_pin: custPin || undefined,
        customer_type: "regular",
      });
      customerId = newCust.id;
    }
    if (!customerId) customerId = await getWalkinAccountId();
    return customerId;
  };

  // Amount to collect via M-Pesa STK for the current payment method.
  const stkAmount = paymentMethod === "mpesa" ? total : mpesaAmount;

  // Create the invoice (M-Pesa portion left unpaid), then open the STK prompt to collect it.
  const handleStkInvoice = async () => {
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    if (stkAmount <= 0) { toast.error("Enter the M-Pesa amount to collect"); return; }

    if (etimsEnabled && selectedCustomer && selectedCustomer.customer_type === "regular" && !customerHasPin) {
      toast.error("eTIMS is enabled — KRA PIN is required for repeat customers.");
      return;
    }

    let customerId: string | null;
    try {
      customerId = await resolveCustomerId();
    } catch (e: any) { toast.error("Failed to create customer: " + e.message); return; }
    if (!customerId) return;

    const cashPortion = paymentMethod === "cash_mpesa" ? cashAmount : 0;
    const paid = cashPortion; // M-Pesa collected asynchronously via callback
    const stkBalance = Math.max(0, total - paid);

    try {
      const inv = await createInvoice.mutateAsync({
        invoice: {
          customer_id: customerId,
          subtotal,
          tax,
          total,
          paid_amount: paid,
          balance: stkBalance,
          payment_method: paymentMethod as any,
          cash_amount: cashPortion,
          mpesa_amount: 0,
          status: (paid > 0 ? "partial" : "unpaid") as any,
          created_by: user?.id,
          approval_status: "approved",
          walkin_name: customerMode === "walkin" ? (walkinName.trim() || null) : null,
          walkin_phone: customerMode === "walkin" ? (normalizePhone(walkinPhone) || null) : null,
        } as any,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.original_price > i.unit_price ? (i.original_price - i.unit_price) * i.quantity : 0,
          total: i.total,
        })),
      });

      const cust = customers.find(c => c.id === customerId);
      setStkData({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        customerId,
        customerName: customerMode === "new" ? newCustName : customerMode === "walkin" ? (walkinName || "Walk-in Customer") : (cust?.name || "Walk-in"),
        phone: (customerMode === "new" ? newCustPhone : customerMode === "walkin" ? walkinPhone : cust?.phone) || "",
        amount: stkAmount,
      });
      setStkOpen(true);
    } catch (e: any) { toast.error("Failed: " + e.message); }
  };

  const resetAfterSale = () => {
    setItems([]);
    setCashAmount(0);
    setMpesaAmount(0);
    setSelectedCustomerId("");
    setCustomerSearch("");
    setCustomerMode("walkin");
    setNewCustName("");
    setNewCustPhone("");
    setCustPin("");
    setWalkinName("");
    setWalkinPhone("");
  };


  const submitInvoice = async () => {
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    if (paymentMethod !== "partial_debt" && balance > 0) {
      toast.error("Amount doesn't cover total. Use 'Pay Later (Debt)' option.");
      return;
    }
    if (customerMode === "walkin" && balance > 0) {
      toast.error("Debt requires a customer account. Search an existing customer or create a new one.");
      return;
    }

    // Suspended customers cannot take new credit (debt) directly — route for admin approval.
    // Existing (already saved) customers only; a brand-new customer has no history.
    const holdForApproval = customerMode !== "new" && needsApproval;

    // eTIMS KRA PIN check
    if (etimsEnabled && selectedCustomer && selectedCustomer.customer_type === "regular" && !customerHasPin) {
      toast.error("eTIMS is enabled — KRA PIN is required for repeat customers.");
      return;
    }

    let customerId = selectedCustomerId;

    if (customerMode === "new") {
      if (!newCustName.trim()) { toast.error("Enter customer name"); return; }
      try {
        const newCust = await createCustomer.mutateAsync({
          name: newCustName,
          phone: newCustPhone || undefined,
          kra_pin: custPin || undefined,
          customer_type: "regular",
        });
        customerId = newCust.id;
      } catch (e: any) {
        toast.error("Failed to create customer: " + e.message);
        return;
      }
    }

    if (!customerId) {
      try { customerId = await getWalkinAccountId(); }
      catch (e: any) { toast.error("Failed: " + e.message); return; }
    }
    const isWalkinSale = customerMode === "walkin";

    const overpaid = Math.max(0, Math.round((paidAmount - total) * 100) / 100);

    try {
      const inv = await createInvoice.mutateAsync({
        invoice: {
          customer_id: customerId,
          subtotal,
          tax,
          total,
          paid_amount: Math.min(paidAmount, total),
          balance,
          payment_method: paymentMethod as any,
          cash_amount: paymentMethod === "mpesa" ? 0 : cashAmount,
          mpesa_amount: paymentMethod === "cash" ? 0 : mpesaAmount,
          status: (balance === 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid") as any,
          created_by: user?.id,
          approval_status: holdForApproval ? "pending" : "approved",
          approval_reason: holdForApproval ? (creditStatus?.reasons.join("; ") || null) : null,
          walkin_name: isWalkinSale ? (walkinName.trim() || null) : null,
          walkin_phone: isWalkinSale ? (normalizePhone(walkinPhone) || null) : null,
        } as any,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.original_price > i.unit_price ? (i.original_price - i.unit_price) * i.quantity : 0,
          total: i.total,
        })),
      });
      toast.success(holdForApproval
        ? "Invoice held for admin approval (customer over limit / overdue)."
        : "Invoice created!");

      if (overpaid > 0) {
        setOverpayData({
          invoiceId: inv.id,
          invoiceNumber: (inv as any).invoice_number,
          customerId,
          customerName: customerMode === "walkin"
            ? (walkinName.trim() || "Walk-in customer")
            : (selectedCustomer?.name || newCustName || "Customer"),
          overpaid,
          cash: paymentMethod === "mpesa" ? 0 : Math.max(0, cashAmount - total),
          mpesa: paymentMethod === "cash" ? 0 : Math.max(0, overpaid - Math.max(0, cashAmount - total)),
        });
        setOverpayOpen(true);
      }

      setItems([]);
      setCashAmount(0);
      setMpesaAmount(0);
      setSelectedCustomerId("");
      setCustomerSearch("");
      setWalkinName("");
      setWalkinPhone("");
    } catch (e: any) { toast.error("Failed: " + e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold font-heading">New Invoice</h1>
        {etimsEnabled && <Badge className="bg-success/10 text-success">eTIMS Active</Badge>}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Product search + items */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Add Products / Services</CardTitle></CardHeader>
            <CardContent>
              <StockSearchAutocomplete
                etimsEnabled={etimsEnabled}
                vatRate={vatRate}
                onSelect={(p) => addItem(p.id)}
              />
            </CardContent>
          </Card>

          {items.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Invoice Items</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Item</TableHead><TableHead className="w-20">Qty</TableHead><TableHead className="w-24">Price</TableHead>
                    {items.some(i => i.unit_price < i.original_price) && <TableHead className="w-20">Discount</TableHead>}
                    <TableHead className="text-right">Total</TableHead><TableHead className="w-10"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {items.map(item => (
                      <TableRow key={item.product_id}>
                        <TableCell>
                          <div className="text-sm">{item.name}</div>
                          {etimsEnabled && <span className="text-xs text-muted-foreground capitalize">{item.tax_category.replace("_", "-")}</span>}
                        </TableCell>
                        <TableCell><Input type="number" min={1} value={item.quantity} onChange={e => updateItemQty(item.product_id, parseInt(e.target.value) || 0)} className="h-8 w-16" /></TableCell>
                        <TableCell><Input type="number" value={item.unit_price} onChange={e => updateItemPrice(item.product_id, Number(e.target.value))} className="h-8 w-20" /></TableCell>
                        {items.some(i => i.unit_price < i.original_price) && (
                          <TableCell className="text-xs text-destructive">
                            {item.unit_price < item.original_price ? `-${((item.original_price - item.unit_price) * item.quantity).toLocaleString()}` : "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium text-sm">{item.total.toLocaleString()}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(item.product_id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Customer + Payment */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                {([
                  { key: "walkin", label: "Walk-in" },
                  { key: "existing", label: "Existing" },
                  { key: "new", label: "New" },
                ] as const).map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setCustomerMode(m.key);
                      if (m.key !== "existing") { setSelectedCustomerId(""); setCustomerSearch(""); }
                    }}
                    className={`rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
                      customerMode === m.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {customerMode === "walkin" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Walk-in Customer</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">No account created</Badge>
                  </div>
                  <Input placeholder="Phone (optional)" value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)} />
                  <Input placeholder="Name (optional)" value={walkinName} onChange={e => setWalkinName(e.target.value)} />

                  {walkinHistory && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-semibold">Repeat walk-in detected</p>
                          <p className="text-muted-foreground">
                            {walkinHistory.visits} previous visit{walkinHistory.visits === 1 ? "" : "s"} · KES {walkinHistory.totalSpent.toLocaleString()} spent
                            {walkinHistory.lastName ? ` · ${walkinHistory.lastName}` : ""}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="w-full h-8" onClick={() => setShowConvert(true)}>
                        <UserPlus className="h-3 w-3 mr-1" /> Convert to Customer
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {customerMode === "new" && (
                <>
                  <Input placeholder="Customer name" value={newCustName} onChange={e => setNewCustName(e.target.value)} />
                  <Input placeholder="Phone (optional)" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} />
                  <Input placeholder="KRA PIN (optional, enables VAT)" value={custPin} onChange={e => setCustPin(e.target.value)} />
                </>
              )}

              {customerMode === "existing" && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, code, phone, PIN..."
                    className="pl-9"
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustDropdown(true); setSelectedCustomerId(""); }}
                    onFocus={() => setShowCustDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)}
                  />
                  {showCustDropdown && customerSearch.trim() && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button key={c.id} className="w-full px-3 py-2 text-left hover:bg-accent" onMouseDown={() => selectCustomer(c.id)}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.customer_code} {c.phone ? `· ${c.phone}` : ""}</p>
                            </div>
                            {Number(c.current_balance) > 0 ? (
                              <Badge variant="destructive" className="text-xs">Owes {Number(c.current_balance).toLocaleString()}</Badge>
                            ) : (
                              <Badge className="bg-success/10 text-success text-xs">Good standing</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <button className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2" onMouseDown={() => { setCustomerMode("new"); setNewCustName(customerSearch); }}>
                          <UserPlus className="h-4 w-4" />
                          <span className="text-sm">Add "{customerSearch}" as new customer</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer && (
                <div className="text-xs space-y-1 bg-muted/50 rounded-md p-2">
                  <p>{selectedCustomer.customer_code} {selectedCustomer.kra_pin ? `· PIN: ${selectedCustomer.kra_pin}` : ""}</p>
                  {selectedCustomer.phone && <p>{selectedCustomer.phone}</p>}
                  {(selectedCustomer as any).location && <p>{(selectedCustomer as any).location}</p>}
                  {Number(selectedCustomer.current_balance) > 0 && (
                    <p className="text-destructive font-medium">Outstanding: KES {Number(selectedCustomer.current_balance).toLocaleString()}</p>
                  )}
                  {Number(selectedCustomer.debt_limit) > 0 && (
                    <p>Credit Limit: KES {Number(selectedCustomer.debt_limit).toLocaleString()} · {Number((selectedCustomer as any).credit_terms) || 0}d terms</p>
                  )}
                  <p className="text-muted-foreground">{selectedCustomer.visit_count} visits · KES {Number(selectedCustomer.total_spent).toLocaleString()} lifetime</p>
                </div>
              )}

            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>KES {subtotal.toLocaleString()}</span></div>
                {etimsEnabled && tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      VAT{items.some(i => i.vat_rate !== null) ? " (mixed rates)" : ` (${(vatRate * 100).toFixed(0)}%)`}
                    </span>
                    <span>KES {Math.round(tax).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>KES {Math.round(total).toLocaleString()}</span></div>
              </div>

              <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="cash_mpesa">Cash + M-Pesa</SelectItem>
                  <SelectItem value="partial_debt">Pay Later (Debt)</SelectItem>
                </SelectContent>
              </Select>

              {(paymentMethod === "cash" || paymentMethod === "cash_mpesa" || paymentMethod === "partial_debt") && (
                <div><Label className="text-xs">Cash Amount</Label><Input type="number" value={cashAmount} onChange={e => setCashAmount(Number(e.target.value))} /></div>
              )}
              {(paymentMethod === "mpesa" || paymentMethod === "cash_mpesa" || paymentMethod === "partial_debt") && (
                <div><Label className="text-xs">M-Pesa Amount</Label><Input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(Number(e.target.value))} /></div>
              )}

              {balance > 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-md p-2 text-center">
                  <p className="text-xs text-warning font-medium">Balance: KES {Math.round(balance).toLocaleString()}</p>
                </div>
              )}

              {creditStatus?.suspended && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 flex items-start gap-2">
                  <Ban className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs text-destructive">
                    <p className="font-semibold">Account suspended</p>
                    <ul className="list-disc pl-4">
                      {creditStatus.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                    {needsApproval && <p className="mt-1">This credit invoice will be held for admin approval.</p>}
                  </div>
                </div>
              )}

              {!creditStatus?.suspended && creditWarning && (
                <div className="bg-warning/10 border border-warning/30 rounded-md p-2 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">{creditWarning}</p>
                </div>
              )}

              <Button className="w-full" onClick={submitInvoice} disabled={items.length === 0 || createInvoice.isPending}>
                {createInvoice.isPending ? "Saving..." : needsApproval ? "Submit for Approval" : "Create Invoice"}
              </Button>

              {(paymentMethod === "mpesa" || paymentMethod === "cash_mpesa") && (
                <Button
                  variant="outline"
                  className="w-full border-success/40 text-success hover:bg-success/10 hover:text-success gap-2"
                  onClick={handleStkInvoice}
                  disabled={items.length === 0 || stkAmount <= 0 || createInvoice.isPending}
                >
                  <Smartphone className="h-4 w-4" />
                  Send STK Push · KES {Math.round(stkAmount).toLocaleString()}
                </Button>
              )}

            </CardContent>
          </Card>
        </div>
      </div>

      <WalkinConvertDialog
        open={showConvert}
        onOpenChange={setShowConvert}
        phone={normalizePhone(walkinPhone)}
        defaultName={walkinName || walkinHistory?.lastName}
        history={walkinHistory}
        onConverted={(id) => { setCustomerMode("existing"); setSelectedCustomerId(id); setCustomerSearch(walkinName || walkinHistory?.lastName || ""); }}
      />

      {stkData && (
        <StkPushDialog
          open={stkOpen}
          onOpenChange={(o) => { setStkOpen(o); if (!o) setStkData(null); }}
          invoiceId={stkData.invoiceId}
          invoiceNumber={stkData.invoiceNumber}
          customerId={stkData.customerId}
          customerName={stkData.customerName}
          defaultPhone={stkData.phone}
          amount={stkData.amount}
          onPaid={resetAfterSale}
        />
      )}

      {overpayData && (
        <OverpaymentDialog
          open={overpayOpen}
          onOpenChange={(o) => { setOverpayOpen(o); if (!o) setOverpayData(null); }}
          customerId={overpayData.customerId}
          customerName={overpayData.customerName}
          invoiceId={overpayData.invoiceId}
          invoiceNumber={overpayData.invoiceNumber}
          overpaid={overpayData.overpaid}
          cashAmount={overpayData.cash}
          mpesaAmount={overpayData.mpesa}
        />
      )}
    </div>
  );
}
