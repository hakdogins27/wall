"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { loadSharedProfile, type SharedProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

const ProfileContext = createContext<{ profile: SharedProfile; loadError: boolean } | null>(null);
export function useLiveProfile(profile: SharedProfile, loadError = false) {
  return useContext(ProfileContext) ?? { profile, loadError };
}
export default function LiveProfileProvider({ profile, loadError, children }: { profile: SharedProfile; loadError: boolean; children: ReactNode }) {
  const [value, setValue] = useState({ profile, loadError });
  const channelId = useId();
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let request = 0;
    const refresh = async () => {
      const id = ++request;
      try {
        const next = await loadSharedProfile(supabase!);
        if (active && id === request) setValue((current) => !current.loadError && JSON.stringify(current.profile) === JSON.stringify(next) ? current : { profile: next, loadError: false });
      } catch { /* Keep the visible profile; subscription reconnect retries the read. */ }
    };
    const channel = supabase.channel(`shared-profile-${channelId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wall_profile", filter: "id=eq.1" }, () => void refresh())
      .subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });
    return () => { active = false; void supabase?.removeChannel(channel); };
  }, [channelId]);
  return <ProfileContext value={value}>{children}</ProfileContext>;
}
