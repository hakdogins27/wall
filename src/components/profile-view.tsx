"use client";

import { useLiveProfile } from "@/components/live-profile-provider";
import ProfileAvatar from "@/components/profile-avatar";
import WallFeed from "@/components/wall-feed";
import { profileSkills, type SharedProfile } from "@/lib/profile";

export default function ProfileView({ profile: initialProfile, loadError: initialError }: { profile: SharedProfile; loadError: boolean }) {
  const { profile, loadError } = useLiveProfile(initialProfile, initialError);
  if (loadError) {
    return (
      <section className="profile-view-panel" aria-labelledby="profile-view-title">
        <h1 id="profile-view-title">Shared profile</h1>
        <p role="status">Profile details could not be loaded.</p>
        <a href="/profile">Reload profile</a>
      </section>
    );
  }

  const skills = profileSkills(profile.skills);
  const links = [
    { label: "Website", href: profile.website },
    { label: "GitHub", href: profile.github },
    { label: "LinkedIn", href: profile.linkedin },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));

  return (
    <article className="profile-timeline" aria-labelledby="profile-view-title">
      <header className="profile-hero">
        <div className="profile-cover" aria-hidden="true" />
        <div className="profile-hero-identity">
          <ProfileAvatar profile={profile} className="profile-hero-avatar" />
          <div className="profile-hero-name">
            <p className="panel-label">Shared profile</p>
            <h1 id="profile-view-title">{profile.display_name}</h1>
          </div>
          <a className="profile-view-edit" href="/profile/edit">Edit profile</a>
        </div>
        <nav className="profile-tabs" aria-label="Profile sections">
          <a href="#profile-wall">Wall</a>
          <a href="#profile-details">About</a>
        </nav>
      </header>

      <div className="profile-timeline-content">
        <aside className="profile-details-card" id="profile-details" aria-labelledby="profile-details-title">
          <h2 id="profile-details-title">Personal details</h2>
          <section className="profile-view-section" aria-labelledby="profile-view-about">
            <h3 id="profile-view-about">About</h3>
            <p>{profile.about || "No introduction added yet."}</p>
          </section>
          <section className="profile-view-section" aria-labelledby="profile-view-skills">
            <h3 id="profile-view-skills">Skills</h3>
            {skills.length > 0 ? <ul className="profile-skills">{skills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p>No skills added yet.</p>}
          </section>
          <section className="profile-view-section" aria-labelledby="profile-view-links">
            <h3 id="profile-view-links">Links</h3>
            {links.length > 0 ? <ul className="profile-view-links">{links.map(({ label, href }) => <li key={label}><a href={href}>{label}</a></li>)}</ul> : <p>No links added yet.</p>}
          </section>
        </aside>
        <section className="profile-wall" id="profile-wall" aria-label="Shared Wall">
          <WallFeed profile={profile} />
        </section>
      </div>
    </article>
  );
}
