"use client";
import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { PlanCards, type PlanCard } from "./plan-cards";
import { api } from "@/lib/utils";

export function BillingView({ plans, plan, usage, stripeConfigured, devSwitch, hasCustomer, ledger, renewsAt }: { plans: PlanCard[]; plan: string; usage: { used: number; quota: number; pct: number; resetsAt: string; remaining: number }; stripeConfigured: boolean; devSwitch: boolean; hasCustomer: boolean; ledger: { id: string; minutes: number; reason: string; createdAt: string }[]; renewsAt: string | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const [portalLoading, setPortalLoading] = React.useState(false);
  React.useEffect(() => {
    const c = params.get("checkout");
    if (c === "success") toast.success("Thanks! Your plan is being activated.", "It can take a few seconds for the webhook to arrive.");
    if (c === "cancelled") toast.info("Checkout cancelled");
    if (c) router.replace("/billing");
  }, [params, router]);
  const current = plans.find((p) => p.id === plan);
  const resets = new Date(usage.resetsAt);
  return (
    <div className="px-8 py-10 md:px-12">
      <PageHeader eyebrow="Billing" title="Plan & usage" description="One minute of rendered export equals one minute of your quota. Previews, cuts and captions are free." />
      <div className="mt-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {current?.label ?? plan} plan <Badge className="ml-2">${current?.price ?? 0}/mo</Badge>
            </CardTitle>
            {stripeConfigured && hasCustomer && (
              <Button
                size="sm"
                variant="outline"
                loading={portalLoading}
                onClick={async () => {
                  setPortalLoading(true);
                  try {
                    const { url } = await api<{ url: string }>("/api/billing/portal", { method: "POST" });
                    window.location.href = url;
                  } catch (e) {
                    toast.error("Could not open portal", e instanceof Error ? e.message : undefined);
                    setPortalLoading(false);
                  }
                }}
              >
                Manage subscription <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="font-display text-4xl">
                  {usage.used.toFixed(1)} <span className="text-lg text-muted">/ {usage.quota} min</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {usage.remaining.toFixed(1)} minutes left · resets {resets.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {renewsAt ? ` · renews ${new Date(renewsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
                </div>
              </div>
              <div className="text-right text-xs text-muted">{usage.pct}% used</div>
            </div>
            <Progress value={usage.pct} className="mt-3 h-2" tone={usage.pct > 90 ? "danger" : usage.pct > 70 ? "accent" : "success"} />
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-bg-3 p-2.5">
                <div className="text-muted">Max resolution</div>
                <div className="mt-0.5 font-medium">{current?.maxResolution === "4k" ? "4K" : current?.maxResolution}</div>
              </div>
              <div className="rounded-lg border border-border bg-bg-3 p-2.5">
                <div className="text-muted">Watermark</div>
                <div className="mt-0.5 font-medium">{current?.watermark ? "Yes" : "None"}</div>
              </div>
              <div className="rounded-lg border border-border bg-bg-3 p-2.5">
                <div className="text-muted">Storage</div>
                <div className="mt-0.5 font-medium">{current ? (current.storageGb >= 1000 ? `${current.storageGb / 1000} TB` : `${current.storageGb} GB`) : "–"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.length ? (
              <ul className="flex flex-col gap-2 text-xs">
                {ledger.map((l) => (
                  <li key={l.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
                    <span className="truncate text-muted">{l.reason}</span>
                    <span className={l.minutes >= 0 ? "text-success" : "text-fg"}>
                      {l.minutes >= 0 ? "+" : ""}
                      {l.minutes.toFixed(1)} min
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted">No exports yet. Your first export will show up here.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {!stripeConfigured && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <div className="font-medium">Billing not configured</div>
            <div className="text-xs text-muted">Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_PRICE_* to enable checkout.{devSwitch ? " In development you can switch plans below without paying." : ""}</div>
          </div>
        </div>
      )}

      <h2 className="mt-10 font-display text-2xl">Plans</h2>
      <div className="mt-4">
        <PlanCards plans={plans} currentPlan={plan} mode="app" stripeConfigured={stripeConfigured} devSwitch={devSwitch} />
      </div>
      <p className="mt-6 text-xs text-muted">Prices in USD. Cancel any time; your plan stays active until the end of the billing period. Unused minutes do not roll over.</p>
    </div>
  );
}
