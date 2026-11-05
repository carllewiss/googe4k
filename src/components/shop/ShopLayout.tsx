import { ReactNode, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Search, User as UserIcon, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdSlot } from "@/components/shop/AdSlot";

export function ShopLayout({ children }: { children: ReactNode }) {
  const { count } = useCart();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/shop?search=${encodeURIComponent(search)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top utility bar */}
      <div className="bg-shop-deep text-shop-deep-foreground text-xs">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between">
          <div className="hidden sm:flex gap-4 items-center">
            <NavLink to="/shop" className="hover:underline">Home</NavLink>
            <NavLink to="/shop/about" className="hover:underline">About</NavLink>
            <NavLink to="/shop/services" className="hover:underline">Services</NavLink>
            <NavLink to="/shop/blog" className="hover:underline">Blog</NavLink>
            <NavLink to="/shop/contact" className="hover:underline">Contact</NavLink>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="hidden md:inline opacity-75">+254 736 217 411</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center gap-4">
          <Link to="/shop" className="flex items-center gap-2 shrink-0">
            <div className="bg-shop-deep text-shop-deep-foreground px-3 py-2 rounded-md font-bold tracking-tight">
              4K SMART
            </div>
          </Link>

          <form onSubmit={onSearch} className="flex-1 max-w-xl mx-auto hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-10 bg-muted/40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>

          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account">
                  <UserIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/shop/account")}>
                      My Account
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/shop/account/orders")}>
                      My Orders
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut().then(() => navigate("/"))}>
                      Sign Out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/shop/signin")}>
                      Sign In
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/shop/signup")}>
                      Create Account
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/shop/cart")} aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-shop-accent text-shop-accent-foreground text-[10px] font-semibold rounded-full h-5 w-5 flex items-center justify-center">
                  {count}
                </span>
              )}
            </Button>

            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t px-4 py-3 flex flex-col gap-2 bg-card">
            <form onSubmit={onSearch}>
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </form>
            <NavLink to="/shop" className="py-2" onClick={() => setMobileOpen(false)}>Shop</NavLink>
            <NavLink to="/shop/services" className="py-2" onClick={() => setMobileOpen(false)}>Services</NavLink>
            <NavLink to="/shop/blog" className="py-2" onClick={() => setMobileOpen(false)}>Blog</NavLink>
            <NavLink to="/shop/contact" className="py-2" onClick={() => setMobileOpen(false)}>Contact</NavLink>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Newsletter + Footer */}
      <section className="bg-shop-deep text-shop-deep-foreground">
        <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-6 items-center">
          <h3 className="text-2xl md:text-3xl font-bold font-heading">Subscribe to our Newsletter</h3>
          <form className="flex gap-2">
            <Input placeholder="Enter your email" className="bg-card text-foreground" />
            <Button type="button" className="bg-shop-accent hover:bg-shop-accent/90 text-shop-accent-foreground">
              Submit
            </Button>
          </form>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-4 gap-8 text-sm">
            <div>
              <div className="bg-card text-foreground inline-block px-3 py-1 rounded font-bold mb-4">4K SMART</div>
              <p className="opacity-70 mb-4">Phone accessories, internet, printing & government services in Kenya.</p>
              <div className="flex gap-3 opacity-80">
                <span className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs">f</span>
                <span className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs">𝕏</span>
                <span className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs">▶</span>
                <span className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs">◎</span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Pages</h4>
              <ul className="space-y-2 opacity-80">
                <li><Link to="/shop">Home</Link></li>
                <li><Link to="/shop">Shop</Link></li>
                <li><Link to="/shop/services">Services</Link></li>
                <li><Link to="/shop/blog">Blog</Link></li>
                <li><Link to="/shop/contact">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Categories</h4>
              <ul className="space-y-2 opacity-80">
                <li>Phone Accessories</li>
                <li>Internet Services</li>
                <li>Printing</li>
                <li>Government Services</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Contact Info</h4>
              <p className="opacity-80">Kakamega, Kenya</p>
              <p className="opacity-80">+254 736 217 411</p>
              <p className="opacity-80">4ksmartsolutionsltd@gmail.com</p>
            </div>
          </div>

          {/* Footer advertisement */}
          <div className="max-w-4xl mx-auto px-4 pb-6">
            <AdSlot placement="footer" label={false} />
          </div>

          <div className="border-t border-white/10 py-4 text-center text-xs opacity-70">
            © {new Date().getFullYear()} 4K Smart Solutions Ltd. All rights reserved.
          </div>
        </div>
      </section>
    </div>
  );
}
