"use client";

// Reload links use full navigation to retry failed server profile reads.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLiveProfile } from "@/components/live-profile-provider";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";
import ProfilePhotoPicker from "@/components/profile-photo-picker";
import { supabase } from "@/lib/supabase";
import {
  createProfilePhotoPath,
  profileToDraft,
  saveSharedProfile,
  type ProfileDraft,
  type SharedProfile,
  uploadProfilePhoto,
  validateProfileDraft,
} from "@/lib/profile";
import { countCharacters, validatePostImage } from "@/lib/posts";

const subscribeReady = () => () => {};

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  const top = element.parentElement!.getBoundingClientRect().top;
  const fields = Array.from(element.closest("form")!.querySelectorAll<HTMLTextAreaElement>(".profile-growing-textarea"))
    .filter((field) => Math.abs(field.parentElement!.getBoundingClientRect().top - top) < 1);
  for (const field of fields) field.style.height = "auto";
  const height = Math.min(Math.max(...fields.map((field) => field.scrollHeight + 2)), 320);
  for (const field of fields) {
    field.style.height = `${height}px`;
    field.style.overflowY = field.scrollHeight > field.clientHeight ? "auto" : "hidden";
  }
}

function GrowingTextarea({
  id,
  label,
  value,
  rows,
  limit,
  disabled,
  onChange,
  placeholder,
  fullWidth = false,
}: {
  id: string;
  label: string;
  value: string;
  rows: number;
  limit: number;
  disabled: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  fullWidth?: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const count = countCharacters(value);

  useEffect(() => resizeTextarea(textarea.current), [value]);

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      resizeTextarea(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`profile-growing-field${fullWidth ? " profile-field-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <textarea
        ref={textarea}
        id={id}
        className="profile-growing-textarea"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-describedby={`${id}-counter`}
        aria-invalid={count > limit}
      />
      <span className={`profile-field-counter${count > limit ? " count-error" : ""}`} id={`${id}-counter`}>
        {count} / {limit.toLocaleString()} characters
      </span>
    </div>
  );
}

export default function ProfileEditor({
  initialProfile,
  loadError,
}: {
  initialProfile: SharedProfile;
  loadError: boolean;
}) {
  const hydrated = useSyncExternalStore(subscribeReady, () => true, () => false);
  const [editingStarted, setEditingStarted] = useState(false);
  const { profile: liveProfile, loadError: profileLoadError } = useLiveProfile(initialProfile, loadError);
  const [discardTarget, setDiscardTarget] = useState<string | null>(null);
  const allowNavigation = useRef(false);
  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState<ProfileDraft>(() => profileToDraft(initialProfile));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const previewUrl = useRef<string | null>(null);
  const pendingPhotoPath = useRef<string | null>(null);
  const saveInFlight = useRef(false);

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      allowNavigation.current = true;
      window.location.reload();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(profileToDraft(profile)) || Boolean(photoFile) || (photoRemoved && Boolean(profile.photo_path));

  if (!dirty && !isSaving && !editingStarted && JSON.stringify(liveProfile) !== JSON.stringify(profile)) {
    setProfile(liveProfile);
    setDraft(profileToDraft(liveProfile));
  }

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigation.current || saveInFlight.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeLink = (event: MouseEvent) => {
      if (allowNavigation.current || saveInFlight.current || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href);
      if (target.origin !== window.location.origin || (target.pathname === window.location.pathname && target.search === window.location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      setDiscardTarget(link.href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeLink, true);
    };
  }, [dirty]);

  const clearPhotoSelection = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    pendingPhotoPath.current = null;
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const updateDraft = (field: keyof ProfileDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage("");
  };

  const handlePhotoFile = (file: File): boolean => {
    const validationError = validatePostImage(file);
    if (validationError) {
      setError(true);
      setMessage(validationError);
      return false;
    }
    clearPhotoSelection();
    const nextPreview = URL.createObjectURL(file);
    previewUrl.current = nextPreview;
    setPhotoFile(file);
    setPhotoPreview(nextPreview);
    setPhotoRemoved(false);
    setError(false);
    setMessage("");
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || loadError || saveInFlight.current) return;
    const validationError = validateProfileDraft(draft);
    if (validationError) {
      setError(true);
      setMessage(validationError);
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setError(false);
    setMessage("");
    let redirecting = false;
    try {
      let photoPath = photoRemoved ? null : profile.photo_path;
      if (photoFile) {
        photoPath = pendingPhotoPath.current;
        if (!photoPath) {
          setIsUploading(true);
          try {
            photoPath = await uploadProfilePhoto(
              supabase,
              createProfilePhotoPath(photoFile),
              photoFile,
            );
            pendingPhotoPath.current = photoPath;
          } finally {
            setIsUploading(false);
          }
        }
      }
      const saved = await saveSharedProfile(supabase, draft, photoPath, profile);
      setProfile(saved);
      setDraft(profileToDraft(saved));
      clearPhotoSelection();
      setPhotoRemoved(false);
      setMessage("Profile saved. Opening your profile…");
      allowNavigation.current = true;
      redirecting = true;
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Reload public profile data after saving, without reusing a cached route.
      window.location.assign("/profile?updated=1");
    } catch {
      setError(true);
      setMessage("The profile couldn’t be saved. Your edits are still here; try again when you’re ready.");
    } finally {
      if (!redirecting) {
        saveInFlight.current = false;
        setIsSaving(false);
      }
    }
  };

  if (profileLoadError) {
    return (
      <section className="profile-editor-page">
        <Link className="profile-back-link" href="/profile" prefetch={false}>Back to profile</Link>
        <h1>Edit the shared profile</h1>
        <p className="profile-editor-message error" role="alert">
          The current profile couldn’t be loaded, so editing is paused to protect its saved details.
        </p>
        <a href="/profile/edit">Reload profile</a>
      </section>
    );
  }

  const avatarPhoto = photoRemoved ? null : photoPreview ?? undefined;

  return (
    <section className="profile-editor-page">
      <Link className="profile-back-link" href="/profile" prefetch={false}>Back to profile</Link>
      <header className="profile-editor-heading">
        <ProfilePhotoPicker
          profile={profile}
          photoUrl={avatarPhoto}
          disabled={isSaving || !hydrated}
          hasPhoto={!photoRemoved && (photoFile !== null || Boolean(profile.photo_path))}
          onSelectPhoto={handlePhotoFile}
          onRemovePhoto={() => {
            clearPhotoSelection();
            setPhotoRemoved(true);
            setError(false);
            setMessage("");
          }}
        />
        <div>
          <p className="panel-label">Shared profile</p>
          <h1>Edit profile</h1>
        </div>
      </header>

      {dirty && !isSaving && JSON.stringify(liveProfile) !== JSON.stringify(profile) && <p role="status" className="interaction-note">Profile changed elsewhere. Your unsaved edits are still here.</p>}
      <form className="profile-editor-form" onSubmit={handleSubmit} onFocusCapture={() => setEditingStarted(true)}>
        <GrowingTextarea
          id="profile-display-name"
          label="Display name"
          value={draft.displayName}
          rows={1}
          limit={80}
          disabled={isSaving || !hydrated}
          onChange={(value) => updateDraft("displayName", value)}
        />
        <GrowingTextarea
          id="profile-skills"
          label="Skills (separate with commas)"
          value={draft.skills}
          rows={1}
          limit={500}
          disabled={isSaving || !hydrated}
          onChange={(value) => updateDraft("skills", value)}
        />
        <GrowingTextarea
          fullWidth
          id="profile-about"
          label="About"
          value={draft.about}
          rows={3}
          limit={1000}
          disabled={isSaving || !hydrated}
          onChange={(value) => updateDraft("about", value)}
        />
        <GrowingTextarea
          fullWidth
          id="profile-website"
          label="Website"
          value={draft.website}
          rows={1}
          limit={500}
          disabled={isSaving || !hydrated}
          placeholder="https://example.com"
          onChange={(value) => updateDraft("website", value)}
        />
        <GrowingTextarea
          id="profile-github"
          label="GitHub"
          value={draft.github}
          rows={1}
          limit={500}
          disabled={isSaving || !hydrated}
          placeholder="https://github.com/username"
          onChange={(value) => updateDraft("github", value)}
        />
        <GrowingTextarea
          id="profile-linkedin"
          label="LinkedIn"
          value={draft.linkedin}
          rows={1}
          limit={500}
          disabled={isSaving || !hydrated}
          placeholder="https://linkedin.com/in/username"
          onChange={(value) => updateDraft("linkedin", value)}
        />

        {message && (
          <p className={`profile-editor-message${error ? " error" : " success"}`} role="status" aria-live="polite">
            {message}
          </p>
        )}
        <div className="profile-editor-actions">
          <Button type="submit" size="lg" disabled={isSaving || !supabase || !hydrated}>
            {isUploading ? "Uploading photo…" : isSaving ? "Saving…" : "Save shared profile"}
          </Button>
          <Link href="/profile" prefetch={false}>Cancel</Link>
        </div>
      </form>
      {discardTarget && (
        <ConfirmationDialog
          title="Discard your changes?"
          description="Your unsaved profile edits will be lost."
          confirmLabel="Discard changes"
          onCancel={() => setDiscardTarget(null)}
          onConfirm={() => { allowNavigation.current = true; window.location.assign(discardTarget); }}
        />
      )}
    </section>
  );
}
