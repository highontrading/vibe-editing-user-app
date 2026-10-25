import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";

export const metadata: Metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireUser();
  const firstName = (user.name ?? user.email.split("@")[0] ?? "there").split(/\s+/)[0]!;
  return <WelcomeTour firstName={firstName} />;
}
