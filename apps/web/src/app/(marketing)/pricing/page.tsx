import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@vibe/db";
import { planCatalog } from "@/lib/plan";
import { stripeConfigured } from "@/lib/stripe";
import { PlanCards } from "@/components/billing/plan-cards";
import { FaqList } from "@/components/marketing/faq";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

const FAQ = [
  { q: "What counts as a minute?", a: "One minute of rendered export. Previews in the browser, captions, cuts and re-plans are free and unlimited." },
  { q: "What happens when I run out?", a: "You can keep editing; exports wait until the cycle resets 30 days after it started, or you upgrade." },
  { q: "Can I cancel?", a: "Any time from Billing. Your plan stays active until the end of the period you paid for." },
  { q: "Do unused minutes roll over?", a: "No. Each cycle starts fresh with the plan's minutes." },
];

export default async function PricingPage() {
  const session = await auth();
  const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true } }) : null;
  const configured = stripeConfigured();
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-center">
        <h1 className="font-display text-5xl tracking-tight md:text-6xl">Pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">Start free. Pay for rendered minutes, not for thinking. Resolution, watermark and storage grow with the plan.</p>
      </div>
      <div className="mt-14">
        <PlanCards plans={planCatalog()} mode={user ? "app" : "marketing"} currentPlan={user?.plan} stripeConfigured={configured} devSwitch={!configured && process.env.NODE_ENV !== "production"} />
      </div>
      <div className="mx-auto mt-20 max-w-3xl">
        <h2 className="font-display text-3xl">Billing questions</h2>
        <div className="mt-6">
          <FaqList items={FAQ} />
        </div>
      </div>
    </div>
  );
}
