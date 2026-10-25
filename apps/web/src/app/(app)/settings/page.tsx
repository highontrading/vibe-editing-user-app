import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { userToMe } from "@/lib/dto";
import { SettingsView } from "@/components/settings/settings-view";
import { signOutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  return <SettingsView me={userToMe(user)} signOut={signOutAction} />;
}
