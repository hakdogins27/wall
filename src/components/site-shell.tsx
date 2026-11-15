import LiveProfileProvider from "@/components/live-profile-provider";
import type { ReactNode } from "react";
import Link from "next/link";
import SharedProfilePanel from "@/components/shared-profile-panel";
import SiteNavigation from "@/components/site-navigation";
import WallNotifications, { WallNotificationsProvider } from "@/components/wall-notifications";
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
          <SiteNavigation currentPage={currentPage} />
        </div>
      </header>

      <div className={`page-shell${currentPage !== "wall" ? " profile-shell" : ""}`}>
        {currentPage === "wall" && <SharedProfilePanel profile={profile} loadError={profileLoadError} />}
        <main className="page-main" id="main">{children}</main>
        {currentPage === "wall" && <aside className="side-panel about-panel" aria-labelledby="notifications-title">
          <p className="panel-label">Updates</p>
          <h2 id="notifications-title">Notifications</h2>
          <WallNotifications />
        </aside>}
      </div>

      <footer className="site-footer">
        <span>Wall · Small updates. Shared openly.</span>
        <span>Posts are public and visible to every visitor.</span>
      </footer>
    </>
  );
  return <WallNotificationsProvider>{currentPage === "about" ? content : <LiveProfileProvider profile={profile} loadError={profileLoadError}>{content}</LiveProfileProvider>}</WallNotificationsProvider>;
}
