import Link from "next/link";
import SiteShell from "@/components/site-shell";
import { DEFAULT_SHARED_PROFILE } from "@/lib/profile";

export default function AboutPage() {
  return (
    <SiteShell profile={DEFAULT_SHARED_PROFILE} profileLoadError={false} currentPage="about">
      <article className="about-page" aria-labelledby="about-wall-title">
        <p className="panel-label">Welcome to Wall</p>
        <h1 id="about-wall-title">A little space to stay connected.</h1>
        <p>Share a thought, a small update, or a photo in one public place.</p>
        <section>
          <h2>Share without signing in</h2>
          <p>Write up to 280 characters, add an optional JPEG, PNG, or WebP photo up to 2 MB, and press Share. Posts stay on the Wall after a refresh, with the newest first.</p>
        </section>
        <section>
          <h2>One shared profile</h2>
          <p>Every post uses the same shared display name. It does not identify who wrote it. Anyone can edit the shared profile picture, name, About, skills, and links without logging in.</p>
          <Link href="/profile">View the shared profile</Link>
        </section>
        <section>
          <h2>Join the conversation</h2>
          <p>Like a post, add a public comment, or share its direct link. Comments stay in Supabase and update live. Likes are limited to one per post in this browser tab/session; they do not verify unique people. The anonymous reaction token stays in session storage, while posts and comments stay in the database.</p>
        </section>
        <section>
          <h2>Shared openly</h2>
          <p>Posts, photos, and profile details are public. Share only what you want every visitor to see. Live updates bring new posts into the feed without a refresh.</p>
        </section>
        <Link className="profile-view-edit" href="/">Go to the Wall</Link>
      </article>
    </SiteShell>
  );
}
