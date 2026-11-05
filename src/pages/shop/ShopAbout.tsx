import { ShopLayout } from "@/components/shop/ShopLayout";

export default function ShopAbout() {
  return (
    <ShopLayout>
      <div className="max-w-3xl mx-auto px-4 py-12 prose prose-lg">
        <h1 className="font-heading">About 4K Smart Solutions</h1>
        <p className="lead text-muted-foreground">
          We are a Kenyan-based business providing phone accessories, internet services, printing,
          and government-related services like KRA, NSSF, HELB and eTIMS — all under one roof.
        </p>
        <h2>Our Mission</h2>
        <p>To make essential digital and government services simple, accessible, and affordable for every Kenyan.</p>
        <h2>What We Offer</h2>
        <ul>
          <li>Genuine phone accessories at competitive prices</li>
          <li>Internet packages and connectivity solutions</li>
          <li>Document printing, scanning and lamination</li>
          <li>KRA, NSSF, eTIMS, HELB, eCitizen and other government services</li>
        </ul>
      </div>
    </ShopLayout>
  );
}
