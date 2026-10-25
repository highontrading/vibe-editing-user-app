import { SiteFooter, SiteNav } from "@/components/marketing/site-nav";
import { Toaster } from "@/components/ui/toast";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}
