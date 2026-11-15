import ProfileEditor from "@/components/profile-editor";
import SiteShell from "@/components/site-shell";
import { loadSharedProfileOrDefault } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const { profile, error } = await loadSharedProfileOrDefault(supabase);

  return (
    <SiteShell profile={profile} profileLoadError={error} currentPage="profile">
      <ProfileEditor initialProfile={profile} loadError={error} />
    </SiteShell>
  );
}
