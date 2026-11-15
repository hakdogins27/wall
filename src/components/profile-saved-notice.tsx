"use client";

import { useEffect, useState } from "react";

export default function ProfileSavedNotice() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("updated");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="profile-saved-toast" role="status" aria-live="polite">
      <span>Your profile changes have been saved.</span>
      <button type="button" aria-label="Dismiss notification" onClick={() => setVisible(false)}>×</button>
    </div>
  );
}
