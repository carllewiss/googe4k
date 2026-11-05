import {
  LayoutDashboard, FileText, Users, Package, PackagePlus, ShoppingCart, Receipt, TrendingUp, UserCog, Settings, ShieldCheck,
  Store, HandCoins, MessageSquare, Newspaper, Undo2, BookOpen, ClipboardCheck, Wrench, Wifi, Smartphone, Scale, Wallet, SlidersHorizontal, Truck, CreditCard, CalendarRange, DatabaseBackup,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePendingApprovals } from "@/hooks/useInvoiceApprovals";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const { isAdmin } = useAuth();
  const collapsed = state === "collapsed";
  const { data: pendingApprovals = [] } = usePendingApprovals();

  const mainItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "New Invoice", url: "/invoices/new", icon: FileText },
    { title: "Invoices", url: "/invoices", icon: Receipt },
    ...(isAdmin ? [{ title: "Approvals", url: "/approvals", icon: ClipboardCheck, badge: pendingApprovals.length || undefined }] : []),
    ...(isAdmin ? [{ title: "Credit Notes", url: "/credit-notes", icon: Undo2 }] : []),
    { title: "Customers", url: "/customers", icon: Users },
    { title: "Receivables", url: "/receivables", icon: HandCoins },
  ];

  const inventoryItems = isAdmin ? [
    { title: "Inventory", url: "/inventory", icon: Package },
    { title: "Opening Stock", url: "/inventory/opening-stock", icon: PackagePlus },
    { title: "Adjustments", url: "/inventory/adjustments", icon: SlidersHorizontal },
    { title: "Purchases", url: "/purchases", icon: ShoppingCart },
    { title: "Suppliers", url: "/purchases/suppliers", icon: Truck },
  ] : [];

  const financeItems = isAdmin ? [
    { title: "Expenses", url: "/expenses", icon: Wallet },
    { title: "Financial Statements", url: "/financials", icon: Scale },
    { title: "Accounting", url: "/accounting", icon: BookOpen },
    { title: "Payments", url: "/payments", icon: CreditCard },
    { title: "Period Management", url: "/accounting/periods", icon: CalendarRange },
    { title: "WiFi Revenue", url: "/wifi", icon: Wifi },
    { title: "M-Pesa Payments", url: "/mpesa", icon: Smartphone },
  ] : [];

  const adminItems = isAdmin ? [
    { title: "Shop Orders", url: "/admin/shop-orders", icon: Store },
    { title: "Service Inquiries", url: "/admin/inquiries", icon: MessageSquare },
    { title: "Services", url: "/admin/services", icon: Wrench },
    { title: "Blog Posts", url: "/admin/blog", icon: Newspaper },
    { title: "eTIMS Sync", url: "/etims", icon: ShieldCheck },
    { title: "User Management", url: "/users", icon: UserCog },
    { title: "Database Backup", url: "/admin/backup", icon: DatabaseBackup },
    { title: "Settings", url: "/settings", icon: Settings },
  ] : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed ? (
          <div>
            <h1 className="text-lg font-bold font-heading text-sidebar-primary-foreground tracking-tight">
              4K SMART
            </h1>
            <p className="text-xs text-sidebar-foreground/60">Solutions Ltd</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="text-lg font-bold text-sidebar-primary-foreground">4K</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Main" items={mainItems} collapsed={collapsed} />
        {inventoryItems.length > 0 && <NavGroup label="Stock" items={inventoryItems} collapsed={collapsed} />}
        {financeItems.length > 0 && <NavGroup label="Finance" items={financeItems} collapsed={collapsed} />}
        {adminItems.length > 0 && <NavGroup label="Admin" items={adminItems} collapsed={collapsed} />}
      </SidebarContent>
    </Sidebar>
  );
}

function NavGroup({ label, items, collapsed }: { label: string; items: { title: string; url: string; icon: any; badge?: number }[]; collapsed: boolean }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                  <item.icon className="mr-2 h-4 w-4" />
                  {!collapsed && <span className="flex-1">{item.title}</span>}
                  {!collapsed && item.badge ? (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

