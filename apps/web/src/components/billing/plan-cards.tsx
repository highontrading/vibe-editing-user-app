"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { api, cn } from "@/lib/utils";

export type PlanCard = { id: "FREE" | "CREATOR" | "PRO" | "STUDIO"; label: string; price: number; minutes: number; maxResolution: string; watermark: boolean; projects: number; storageGb: number; generative: boolean };

export function planFeatures(p: PlanCard): string[] {
  return [
    `${p.minutes} minutes of export / month`,
    `Up to ${p.maxResolution === "4k" ? "4K" : p.maxResolution} exports`,
    p.watermark ? "Small watermark" : "No watermark",
    `${p.storageGb >= 1000 ? `${p.storageGb / 1000} TB` : `${p.storageGb} GB`} storage`,
    p.projects >= 100000 ? "Unlimited projects" : `${p.projects} active projects`,
    ...(p.generative ? ["AI b-roll & generative media"] : []),
    ...(p.id === "STUDIO" ? ["Priority rendering", "Team workspaces (soon)"] : []),
  ];
}

export function PlanCards({ plans, currentPlan, mode, stripeConfigured, devSwitch, compact }: { plans: PlanCard[]; currentPlan?: string; mode: "app" | "marketing"; stripeConfigured?: boolean; devSwitch?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState<string | null>(null);
  async function choose(plan: PlanCard["id"]) {
    if (mode === "marketing") return router.push(`/signup?next=${encodeURIComponent(`/billing?plan=${plan}`)}`);
    setLoading(plan);
    try {
      if (stripeConfigured) {
        if (plan === "FREE") {
          const { url } = await api<{ url: string }>("/api/billing/portal", { method: "POST" });
          window.location.href = url;
          return;
        }
        const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST", json: { plan } });
        window.location.href = url;
        return;
      }
      if (devSwitch) {
        await api("/api/billing/plan", { method: "POST", json: { plan } });
        toast.success(`Switched to ${plan.charAt(0) + plan.slice(1).toLowerCase()}`, "Development mode: no payment was made.");
        router.refresh();
        return;
      }
      toast.info("Billing not configured", "Set STRIPE_SECRET_KEY and the price ids to enable checkout.");
    } catch (e) {
      toast.error("Could not start checkout", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(null);
    }
  }
  return (
    <div className={cn("grid gap-4", compact ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-4")}>
      {plans.map((p) => {
        const current = currentPlan === p.id;
        const highlight = p.id === "CREATOR";
        return (
          <div key={p.id} className={cn("relative flex flex-col rounded-2xl border bg-bg-2 p-5", highlight ? "border-accent/60 shadow-[0_0_0_1px_rgba(255,212,0,.2),0_30px_60px_-30px_rgba(255,212,0,.25)]" : "border-border", current && "ring-1 ring-accent-2/60")}>
            {highlight && (
              <Badge tone="accent" className="absolute -top-2.5 left-5">
                Most popular
              </Badge>
            )}
            <div className="flex items-center justify-between">
              <div className="font-display text-2xl">{p.label}</div>
              {current && <Badge tone="info">Current</Badge>}
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-4xl">${p.price}</span>
              <span className="text-sm text-muted">/ month</span>
            </div>
            <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
              {planFeatures(p).map((f) => (
                <li key={f} className="flex items-start gap-2 text-fg/90">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-6 w-full"
              variant={current ? "outline" : highlight ? "accent" : "primary"}
              disabled={current && mode === "app" && !(stripeConfigured && p.id !== "FREE")}
              loading={loading === p.id}
              onClick={() => choose(p.id)}
            >
              {mode === "marketing" ? (p.id === "FREE" ? "Start free" : `Get ${p.label}`) : current ? (stripeConfigured && p.id !== "FREE" ? "Manage" : "Current plan") : p.id === "FREE" ? "Downgrade" : <>
                <Sparkles className="h-4 w-4" /> Upgrade to {p.label}
              </>}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
