"use client";

import { useLiveProfile } from "@/components/live-profile-provider";
import type { SharedProfile } from "@/lib/profile";
import { getProfilePhotoUrl } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export default function ProfileAvatar({
  profile: initialProfile,
  className = "",
  photoUrl,
}: {
  profile: SharedProfile;
  className?: string;
  photoUrl?: string | null;
}) {
  const { profile } = useLiveProfile(initialProfile);
  const resolvedPhotoUrl = photoUrl === undefined
    ? getProfilePhotoUrl(supabase, profile.photo_path)
    : photoUrl;
  const initials = profile.display_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();

  return (
    <div className={`avatar ${className}`.trim()} aria-hidden="true">
      {resolvedPhotoUrl ? (
        // Native img accepts the configured project's public Storage URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedPhotoUrl} alt="" width={52} height={52} />
      ) : initials}
    </div>
  );
}
