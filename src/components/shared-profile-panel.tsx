"use client";

import { useLiveProfile } from "@/components/live-profile-provider";
import Link from "next/link";
import ProfileAvatar from "@/components/profile-avatar";
import { profileSkills, type SharedProfile } from "@/lib/profile";

export default function SharedProfilePanel({
  profile: initialProfile,
  loadError: initialError,
}: {
  profile: SharedProfile;
  loadError: boolean;
}) {
  const { profile, loadError } = useLiveProfile(initialProfile, initialError);
  const skills = profileSkills(profile.skills);
  const links = [
    { label: "Website", href: profile.website },
    { label: "GitHub", href: profile.github },
    { label: "LinkedIn", href: profile.linkedin },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));

  return (
    <aside className="side-panel identity-panel" aria-labelledby="identity-title">
      <p className="panel-label">Profile</p>
      <div className="identity-row">
        <ProfileAvatar className="profile-avatar" profile={profile} />
        <h2 id="identity-title">
          <Link href="/profile" prefetch={false} className="profile-name-link">{profile.display_name}</Link>
        </h2>
      </div>
      {loadError && <p className="profile-load-error" role="status">Shared profile details could not be loaded.</p>}
      <section className="profile-section" aria-labelledby="profile-about-title">
        <h3 id="profile-about-title">About me</h3>
        <p>{profile.about || "No introduction added yet."}</p>
      </section>
      <section className="profile-section" aria-labelledby="profile-skills-title">
        <h3 id="profile-skills-title">Areas of focus</h3>
        {skills.length > 0 ? (
          <ul className="profile-skills">
            {skills.map((skill) => <li key={skill}>{skill}</li>)}
          </ul>
        ) : <p>No skills added yet.</p>}
      </section>
      <section className="profile-section" aria-labelledby="profile-links-title">
        <h3 id="profile-links-title">Find me online</h3>
        {links.length > 0 ? (
          <ul className="profile-links">
            {links.map(({ label, href }) => <li key={label}><a href={href}>{label}</a></li>)}
          </ul>
        ) : <p>No links added yet.</p>}
      </section>
    </aside>
  );
}
