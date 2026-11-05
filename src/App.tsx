import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import NewInvoice from "./pages/NewInvoice";
import Invoices from "./pages/Invoices";
import Customers from "./pages/Customers";
import CustomerQuery from "./pages/CustomerQuery";
import Receivables from "./pages/Receivables";
import Inventory from "./pages/Inventory";
import StockQuery from "./pages/StockQuery";
import OpeningStock from "./pages/OpeningStock";
import InventoryAdjustments from "./pages/InventoryAdjustments";
import Purchases from "./pages/Purchases";
import PurchaseOrders from "./pages/PurchaseOrders";
import NewPurchaseInvoice from "./pages/NewPurchaseInvoice";
import Suppliers from "./pages/Suppliers";
import SupplierDetail from "./pages/SupplierDetail";
import Expenses from "./pages/Expenses";
import NewExpense from "./pages/NewExpense";
import UserManagement from "./pages/UserManagement";
import Settings from "./pages/Settings";
import EtimsSyncQueue from "./pages/EtimsSyncQueue";
import CreditNotes from "./pages/CreditNotes";
import Approvals from "./pages/Approvals";
import Accounting from "./pages/Accounting";
import Payments from "./pages/Payments";
import PaymentDetail from "./pages/PaymentDetail";
import SalePaymentDetail from "./pages/SalePaymentDetail";
import PeriodManagement from "./pages/PeriodManagement";
import FinancialStatements from "./pages/FinancialStatements";
import Wifi from "./pages/Wifi";
import Mpesa from "./pages/Mpesa";
import NotFound from "./pages/NotFound";

// Shop (public)
import ShopHome from "./pages/shop/ShopHome";
import ShopCatalog from "./pages/shop/ShopCatalog";
import ShopProductDetail from "./pages/shop/ShopProductDetail";
import ShopCart from "./pages/shop/ShopCart";
import ShopCheckout from "./pages/shop/ShopCheckout";
import ShopOrderSuccess from "./pages/shop/ShopOrderSuccess";
import ShopServices from "./pages/shop/ShopServices";
import ShopBlog from "./pages/shop/ShopBlog";
import ShopBlogPost from "./pages/shop/ShopBlogPost";
import ShopAbout from "./pages/shop/ShopAbout";
import ShopContact from "./pages/shop/ShopContact";
import ShopSignIn from "./pages/shop/ShopSignIn";
import ShopSignUp from "./pages/shop/ShopSignUp";
import ShopAccount from "./pages/shop/ShopAccount";
import ShopOrders from "./pages/shop/ShopOrders";

// Admin extras
import AdminShopOrders from "./pages/admin/AdminShopOrders";
import AdminInquiries from "./pages/admin/AdminInquiries";
import AdminBlog from "./pages/admin/AdminBlog";
import AdminBlogEditor from "./pages/admin/AdminBlogEditor";
import AdminServices from "./pages/admin/AdminServices";
import AdminBackup from "./pages/AdminBackup";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function ErpRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices/new" element={<NewInvoice />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/credit-notes" element={<ProtectedRoute adminOnly><CreditNotes /></ProtectedRoute>} />
        <Route path="/approvals" element={<ProtectedRoute adminOnly><Approvals /></ProtectedRoute>} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/receivables" element={<Receivables />} />
        <Route path="/customers/:customerId" element={<CustomerQuery />} />
        <Route path="/inventory" element={<ProtectedRoute adminOnly><Inventory /></ProtectedRoute>} />
        <Route path="/inventory/opening-stock" element={<ProtectedRoute adminOnly><OpeningStock /></ProtectedRoute>} />
        <Route path="/inventory/adjustments" element={<ProtectedRoute adminOnly><InventoryAdjustments /></ProtectedRoute>} />
        <Route path="/inventory/:productId" element={<StockQuery />} />

        <Route path="/purchases" element={<ProtectedRoute adminOnly><Purchases /></ProtectedRoute>} />
        <Route path="/purchases/orders" element={<ProtectedRoute adminOnly><PurchaseOrders /></ProtectedRoute>} />
        <Route path="/purchases/suppliers" element={<ProtectedRoute adminOnly><Suppliers /></ProtectedRoute>} />
        <Route path="/purchases/suppliers/:id" element={<ProtectedRoute adminOnly><SupplierDetail /></ProtectedRoute>} />
        <Route path="/purchases/new" element={<ProtectedRoute adminOnly><NewPurchaseInvoice /></ProtectedRoute>} />
        <Route path="/purchases/:id" element={<ProtectedRoute adminOnly><NewPurchaseInvoice /></ProtectedRoute>} />
        <Route path="/purchases/:id/edit" element={<ProtectedRoute adminOnly><NewPurchaseInvoice /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute adminOnly><Expenses /></ProtectedRoute>} />
        <Route path="/expenses/new" element={<ProtectedRoute adminOnly><NewExpense /></ProtectedRoute>} />
        <Route path="/finance" element={<Navigate to="/expenses" replace />} />
        <Route path="/accounting" element={<ProtectedRoute adminOnly><Accounting /></ProtectedRoute>} />
        <Route path="/accounting/periods" element={<ProtectedRoute adminOnly><PeriodManagement /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute adminOnly><Payments /></ProtectedRoute>} />
        <Route path="/payments/sale/:id" element={<ProtectedRoute adminOnly><SalePaymentDetail /></ProtectedRoute>} />
        <Route path="/payments/:id" element={<ProtectedRoute adminOnly><PaymentDetail /></ProtectedRoute>} />
        <Route path="/financials" element={<ProtectedRoute adminOnly><FinancialStatements /></ProtectedRoute>} />
        <Route path="/wifi" element={<ProtectedRoute adminOnly><Wifi /></ProtectedRoute>} />
        <Route path="/mpesa" element={<ProtectedRoute adminOnly><Mpesa /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute adminOnly><UserManagement /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
        <Route path="/etims" element={<ProtectedRoute adminOnly><EtimsSyncQueue /></ProtectedRoute>} />
        <Route path="/admin/shop-orders" element={<ProtectedRoute adminOnly><AdminShopOrders /></ProtectedRoute>} />
        <Route path="/admin/inquiries" element={<ProtectedRoute adminOnly><AdminInquiries /></ProtectedRoute>} />
        <Route path="/admin/services" element={<ProtectedRoute adminOnly><AdminServices /></ProtectedRoute>} />
        <Route path="/admin/blog" element={<ProtectedRoute adminOnly><AdminBlog /></ProtectedRoute>} />
        <Route path="/admin/blog/new" element={<ProtectedRoute adminOnly><AdminBlogEditor /></ProtectedRoute>} />
        <Route path="/admin/blog/:id" element={<ProtectedRoute adminOnly><AdminBlogEditor /></ProtectedRoute>} />
        <Route path="/admin/backup" element={<ProtectedRoute adminOnly><AdminBackup /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Build target: "shop" = customer storefront deployment, otherwise = back-office ERP
  const APP_TARGET = import.meta.env.VITE_APP_TARGET ?? "erp";
  const SHOP_ONLY = APP_TARGET === "shop";

  // Public reset-password route — must work even during a recovery session
  if (!SHOP_ONLY && location.pathname === "/reset-password") {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  // Customer storefront build: serve the shop at the domain root, no ERP.
  if (SHOP_ONLY) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/shop" replace />} />
        <Route path="/shop" element={<ShopCatalog />} />
        <Route path="/shop/home" element={<ShopHome />} />
        <Route path="/shop/services" element={<ShopServices />} />
        <Route path="/shop/blog" element={<ShopBlog />} />
        <Route path="/shop/blog/:slug" element={<ShopBlogPost />} />
        <Route path="/shop/about" element={<ShopAbout />} />
        <Route path="/shop/contact" element={<ShopContact />} />
        <Route path="/shop/product/:id" element={<ShopProductDetail />} />
        <Route path="/shop/cart" element={<ShopCart />} />
        <Route path="/shop/checkout" element={<ShopCheckout />} />
        <Route path="/shop/order-success/:id" element={<ShopOrderSuccess />} />
        <Route path="/shop/signin" element={<ShopSignIn />} />
        <Route path="/shop/signup" element={<ShopSignUp />} />
        <Route path="/shop/account" element={<ShopAccount />} />
        <Route path="/shop/account/orders" element={<ShopOrders />} />
        <Route path="*" element={<Navigate to="/shop" replace />} />
      </Routes>
    );
  }

  // Public shop routes — accessible to everyone (logged in or not)
  const isShop = location.pathname === "/shop" || location.pathname.startsWith("/shop/");


  if (isShop) {
    return (
      <Routes>
        <Route path="/shop" element={<ShopCatalog />} />
        <Route path="/shop/home" element={<ShopHome />} />
        <Route path="/shop/services" element={<ShopServices />} />
        <Route path="/shop/blog" element={<ShopBlog />} />
        <Route path="/shop/blog/:slug" element={<ShopBlogPost />} />
        <Route path="/shop/about" element={<ShopAbout />} />
        <Route path="/shop/contact" element={<ShopContact />} />
        <Route path="/shop/product/:id" element={<ShopProductDetail />} />
        <Route path="/shop/cart" element={<ShopCart />} />
        <Route path="/shop/checkout" element={<ShopCheckout />} />
        <Route path="/shop/order-success/:id" element={<ShopOrderSuccess />} />
        <Route path="/shop/signin" element={<ShopSignIn />} />
        <Route path="/shop/signup" element={<ShopSignUp />} />
        <Route path="/shop/account" element={<ShopAccount />} />
        <Route path="/shop/account/orders" element={<ShopOrders />} />
      </Routes>
    );
  }

  // Auth gate for ERP
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<ErpRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
