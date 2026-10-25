import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-display text-5xl tracking-tight">Privacy</h1>
      <p className="mt-3 text-sm text-muted">Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}. Placeholder text; replace before launch.</p>
      <div className="prose-invert mt-10 flex flex-col gap-6 text-sm leading-relaxed text-fg/90">
        <section>
          <h2 className="font-display text-2xl">What we store</h2>
          <p className="mt-2 text-muted">Your account details, the footage you upload, the transcripts and analysis derived from it, your edit scripts, exports and usage. Nothing is sold or used to train models.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Who processes it</h2>
          <p className="mt-2 text-muted">Footage is stored in our object storage and processed on our workers. Transcription and planning may use third-party AI providers under data-processing agreements; audio and frames are sent only for your projects.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Deleting your data</h2>
          <p className="mt-2 text-muted">Delete any asset from the library, any project from Projects, or your whole account from Settings. Deletion removes the files from storage immediately.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Contact</h2>
          <p className="mt-2 text-muted">privacy@vibe.video</p>
        </section>
      </div>
    </div>
  );
}
