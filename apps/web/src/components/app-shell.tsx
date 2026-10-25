"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderOpen, Library, Zap, HelpCircle, Settings, Sparkles, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "./ui/toast";

const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/assets", label: "Asset library", icon: Library },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: { name?: string | null; email?: string | null; image?: string | null; plan: string } }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const isEditor = pathname?.startsWith("/editor/");
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {!isEditor && (
        <aside className={cn("flex h-full flex-col border-r border-border bg-bg transition-[width]", collapsed ? "w-14" : "w-56")}>
          <div className="flex h-14 items-center justify-between px-3">
            <Link href="/home" className={cn("flex items-center gap-2 font-display text-lg", collapsed && "hidden")}>
              <Sparkles className="h-4 w-4 text-accent" /> Vibe
            </Link>
            <button onClick={() => setCollapsed((c) => !c)} className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-fg">
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2">
            {nav.map((n) => {
              const active = pathname === n.href || pathname?.startsWith(n.href + "/");
              return (
                <Link key={n.href} href={n.href} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors", active ? "bg-white/8 text-fg" : "text-muted hover:bg-white/5 hover:text-fg")}>
                  <n.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{n.label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-col gap-0.5 px-2 pb-3">
            {user.plan === "FREE" && (
              <Link href="/billing" className={cn("flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-sm text-fg hover:bg-white/5")}>
                <Zap className="h-4 w-4 text-accent" /> {!collapsed && "Upgrade"}
              </Link>
            )}
            <Link href="/help" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-white/5 hover:text-fg">
              <HelpCircle className="h-4 w-4" /> {!collapsed && "Need any help?"}
            </Link>
            <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-white/5 hover:text-fg">
              <Settings className="h-4 w-4" /> {!collapsed && "Settings"}
            </Link>
            <Link href="/settings" className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-white/5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-2/30 text-[11px] font-semibold uppercase text-accent-2">
                {(user.name ?? user.email ?? "?").slice(0, 1)}
              </div>
              {!collapsed && <span className="truncate text-muted">{user.name ?? user.email}</span>}
            </Link>
          </div>
        </aside>
      )}
      <main className="relative flex-1 overflow-auto">{children}</main>
      <Toaster />
    </div>
  );
}
