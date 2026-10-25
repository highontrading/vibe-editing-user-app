import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-display text-5xl tracking-tight">Terms of service</h1>
      <p className="mt-3 text-sm text-muted">Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}. Placeholder text; replace before launch.</p>
      <div className="mt-10 flex flex-col gap-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-2xl">Your content</h2>
          <p className="mt-2 text-muted">You keep all rights to the footage you upload and the videos you export. You confirm you have the rights to use the footage, music and images you bring.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Acceptable use</h2>
          <p className="mt-2 text-muted">No unlawful content, no harassment, no impersonation, no content that infringes someone else’s rights. We may remove content that breaks these rules.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Plans and billing</h2>
          <p className="mt-2 text-muted">Subscriptions renew monthly until cancelled. Export minutes reset each cycle and do not roll over. Refunds are handled case by case.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Availability</h2>
          <p className="mt-2 text-muted">The service is provided as is. We aim for high availability but make no guarantee, and we are not liable for lost footage you have not backed up.</p>
        </section>
      </div>
    </div>
  );
}
