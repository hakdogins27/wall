import Link from "next/link";
import SiteShell from "@/components/site-shell";
import PostActivityProvider from "@/components/post-activity-provider";
import PostCard from "@/components/post-card";
import { loadPostById } from "@/lib/posts";
import { loadSharedProfileOrDefault } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export default async function SharedPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profileRequest = loadSharedProfileOrDefault(supabase);
  let post = null;
  let failed = !supabase;
  try { if (supabase) post = await loadPostById(supabase, id); } catch { failed = true; }
  const { profile, error } = await profileRequest;
  return (
    <SiteShell profile={profile} profileLoadError={error} currentPage="wall">
      <h1 className="sr-only">Shared Wall post</h1>
      <Link className="profile-back-link" href="/">View the whole Wall</Link>
      {post ? <PostActivityProvider posts={[post]}><PostCard post={post} profile={profile} /></PostActivityProvider> : <section className="feed-state" role="status"><strong>{failed ? "This post couldn’t load." : "This post wasn’t found."}</strong>{failed && <a href={`/post/${id}`}>Try again</a>}</section>}
    </SiteShell>
  );
}
