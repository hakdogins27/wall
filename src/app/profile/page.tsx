import ProfileSavedNotice from "@/components/profile-saved-notice";
import ProfileView from "@/components/profile-view";
import SiteShell from "@/components/site-shell";
import { loadSharedProfileOrDefault } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const { updated } = await searchParams;
  const { profile, error } = await loadSharedProfileOrDefault(supabase);

  return (
    <SiteShell profile={profile} profileLoadError={error} currentPage="profile">
      {updated === "1" && <ProfileSavedNotice />}
      <ProfileView profile={profile} loadError={error} />
    </SiteShell>
  );
}
