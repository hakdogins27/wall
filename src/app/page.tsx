import WallFeed from "@/components/wall-feed";
import SiteShell from "@/components/site-shell";
import { loadSharedProfileOrDefault } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { profile, error } = await loadSharedProfileOrDefault(supabase);

  return (
    <SiteShell profile={profile} profileLoadError={error} currentPage="wall">
      <h1 className="sr-only">The Wall</h1>
      <WallFeed profile={profile} />
    </SiteShell>
  );
}
