import Link from "next/link";
import LiveProfileProvider from "@/components/live-profile-provider";
import type { ReactNode } from "react";
import SharedProfilePanel from "@/components/shared-profile-panel";
import type { SharedProfile } from "@/lib/profile";

export default function SiteShell({
  profile,
  profileLoadError,
  currentPage,
  children,
}: {
  profile: SharedProfile;
  profileLoadError: boolean;
  currentPage: "wall" | "profile" | "about";
  children: ReactNode;
}) {
  const content = (
    <>
      <header className="site-header">
        <div className="header-inner">
          <div className="header-brand">
          <Link className="brand" href="/" aria-label="Wall home">
            Wall
          </Link>
          <span className="header-description">Small updates. Shared openly.</span>
          </div>
          <nav className="site-nav" aria-label="Main navigation">
            <Link href="/" aria-current={currentPage === "wall" ? "page" : undefined}>Wall</Link>
            <Link href="/profile" prefetch={false} aria-current={currentPage === "profile" ? "page" : undefined}>Profile</Link>
            <Link href="/about" aria-current={currentPage === "about" ? "page" : undefined}>About</Link>
          </nav>
          <Link className="header-notifications" href="/#notifications-title" prefetch={false} aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>
            <span>Notifications</span>
          </Link>
        </div>
      </header>

      <div className={`page-shell${currentPage !== "wall" ? " profile-shell" : ""}`}>
        {currentPage === "wall" && <SharedProfilePanel profile={profile} loadError={profileLoadError} />}
        <main className="page-main" id="main">{children}</main>
        {currentPage === "wall" && <aside className="side-panel about-panel" aria-labelledby="notifications-title">
          <p className="panel-label">Updates</p>
          <h2 id="notifications-title">Notifications</h2>
          <p>No notifications yet.</p>
        </aside>}
      </div>

      <footer className="site-footer">
        <span>Wall · Small updates. Shared openly.</span>
        <span>Posts are public and visible to every visitor.</span>
      </footer>
    </>
  );
  return currentPage === "about" ? content : <LiveProfileProvider profile={profile} loadError={profileLoadError}>{content}</LiveProfileProvider>;
}
