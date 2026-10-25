import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@vibe/db";
import { requireUser } from "@/lib/session";
import { planCatalog, usageSummary } from "@/lib/plan";
import { stripeConfigured } from "@/lib/stripe";
import { BillingView } from "@/components/billing/billing-view";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await requireUser();
  const usage = usageSummary(user);
  const ledger = await prisma.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 });
  const configured = stripeConfigured();
  return (
    <Suspense>
      <BillingView
        plans={planCatalog()}
        plan={user.plan}
        usage={{ ...usage, resetsAt: usage.resetsAt.toISOString() }}
        stripeConfigured={configured}
        devSwitch={!configured && process.env.NODE_ENV !== "production"}
        hasCustomer={!!user.stripeCustomerId}
        ledger={ledger.map((l) => ({ id: l.id, minutes: l.minutes, reason: l.reason, createdAt: l.createdAt.toISOString() }))}
        renewsAt={user.planRenewsAt?.toISOString() ?? null}
      />
    </Suspense>
  );
}
