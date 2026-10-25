"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderOpen, Library, Zap, HelpCircle, Settings, Sparkles, PanelLeftClose, PanelLeftOpen, BookOpen, Palette, CreditCard } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "./ui/toast";
import { UploadTray } from "./upload/upload-tray";

const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/assets", label: "Asset library", icon: Library },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/brand", label: "Brand kit", icon: Palette },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: { name?: string | null; email?: string | null; image?: string | null; plan: string } }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("vibe.sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("vibe.sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  };
  const isEditor = pathname?.startsWith("/editor/");
  const isWelcome = pathname?.startsWith("/welcome");
  const hideSidebar = isEditor || isWelcome;
  const NavLink = ({ href, label, icon: Icon, className }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; className?: string }) => {
    const active = pathname === href || pathname?.startsWith(href + "/");
    return (
      <Link href={href} title={collapsed ? label : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors", active ? "bg-white/8 text-fg" : "text-muted hover:bg-white/5 hover:text-fg", collapsed && "justify-center px-0", className)}>
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {!hideSidebar && (
        <aside className={cn("flex h-full shrink-0 flex-col border-r border-border bg-bg transition-[width] duration-200", collapsed ? "w-14" : "w-56")}>
          <div className={cn("flex h-14 items-center px-3", collapsed ? "justify-center" : "justify-between")}>
            <Link href="/home" className={cn("flex items-center gap-2 font-display text-lg", collapsed && "hidden")}>
              <Sparkles className="h-4 w-4 text-accent" /> Vibe
            </Link>
            <button onClick={toggle} className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-fg" aria-label="Toggle sidebar">
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2">
            {nav.map((n) => (
              <NavLink key={n.href} {...n} />
            ))}
          </nav>
          <div className="flex flex-col gap-0.5 px-2 pb-3">
            {user.plan === "FREE" ? (
              <Link href="/billing" title="Upgrade" className={cn("mb-1 flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-sm text-fg hover:bg-white/5", collapsed && "justify-center px-0")}>
                <Zap className="h-4 w-4 text-accent" /> {!collapsed && "Upgrade"}
              </Link>
            ) : (
              <NavLink href="/billing" label="Billing" icon={CreditCard} />
            )}
            <NavLink href="/help" label="Need any help?" icon={HelpCircle} />
            <NavLink href="/settings" label="Settings" icon={Settings} />
            <Link href="/settings" className={cn("mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-white/5", collapsed && "justify-center px-0")}>
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-2/30 text-[11px] font-semibold uppercase text-accent-2">{(user.name ?? user.email ?? "?").slice(0, 1)}</div>
              )}
              {!collapsed && <span className="truncate text-muted">{user.name ?? user.email}</span>}
            </Link>
          </div>
        </aside>
      )}
      <main className="relative flex-1 overflow-auto">{children}</main>
      <UploadTray />
      <Toaster />
    </div>
  );
}
