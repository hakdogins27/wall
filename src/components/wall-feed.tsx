"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import PostCard, { PostDetailDialog } from "@/components/post-card";
import PostActivityProvider from "@/components/post-activity-provider";
import { useLiveProfile } from "@/components/live-profile-provider";
import ProfileAvatar from "@/components/profile-avatar";
import { countCharacters, createPost, createPostImagePath, loadLatestPosts, loadOlderPosts, loadPostById, mergePosts, MAX_POST_IMAGE_BYTES, PAGE_SIZE, uploadPostImage, validatePostBody, validatePostImage } from "@/lib/posts";
import type { Post } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import type { SharedProfile } from "@/lib/profile";
import { createPostDeleteToken } from "@/lib/post-deletion";

type Feedback = { kind: "success" | "error"; text: string };
type RealtimeState = "connecting" | "connected" | "disconnected" | "unavailable";

export default function WallFeed({ profile: initialProfile }: { profile: SharedProfile }) {
  const { profile } = useLiveProfile(initialProfile);
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedError, setFeedError] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(Boolean(supabase));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(
    supabase ? "connecting" : "unavailable",
  );
  const [arrivingPostId, setArrivingPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPostDeleted, setSelectedPostDeleted] = useState(false);
  const postsRef = useRef<Post[]>([]);
  const selectedPostId = useRef<string | null>(null);
  const deletedPostIds = useRef(new Set<string>());
  const incomingVersion = useRef(0);
  const incomingPosts = useRef(new Map<string, { version: number; post: Post }>());
  const feedRequestId = useRef(0);
  const active = useRef(false);
  const submitInFlight = useRef(false);
  const initialFetchStarted = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewUrl = useRef<string | null>(null);
  const pendingImagePath = useRef<string | null>(null);
  const pendingPost = useRef<{ body: string; imagePath: string | null; token: string } | null>(null);
  const arrivalTimer = useRef<number | null>(null);

  const clearSelectedImage = () => {
    if (imagePreviewUrl.current) URL.revokeObjectURL(imagePreviewUrl.current);
    imagePreviewUrl.current = null;
    pendingImagePath.current = null;
    setSelectedImage(null);
    setImagePreview(null);
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  useEffect(() => () => {
    if (imagePreviewUrl.current) URL.revokeObjectURL(imagePreviewUrl.current);
  }, []);

  const commitPosts = useCallback((nextPosts: Post[]) => {
    const visible = nextPosts.filter((post) => !deletedPostIds.current.has(post.id));
    postsRef.current = visible;
    setPosts(visible);
  }, []);

  const removePost = useCallback((postId: string) => {
    if (!/^[0-9a-f-]{36}$/i.test(postId)) return;
    deletedPostIds.current.add(postId);
    incomingPosts.current.delete(postId);
    commitPosts(postsRef.current.filter((post) => post.id !== postId));
    if (selectedPostId.current === postId) setSelectedPostDeleted(true);
  }, [commitPosts]);

  const openPost = (post: Post) => {
    selectedPostId.current = post.id;
    setSelectedPostDeleted(false);
    setSelectedPost(post);
  };

  const closePost = () => {
    const wasDeleted = selectedPostDeleted;
    selectedPostId.current = null;
    setSelectedPost(null);
    setSelectedPostDeleted(false);
    if (wasDeleted) requestAnimationFrame(() => document.getElementById("feed-title")?.focus());
  };

  const markArrival = useCallback((postId: string) => {
    setArrivingPostId(postId);
    if (arrivalTimer.current !== null) window.clearTimeout(arrivalTimer.current);
    arrivalTimer.current = window.setTimeout(() => {
      setArrivingPostId(null);
      arrivalTimer.current = null;
    }, 350);
  }, []);

  const receivePost = useCallback((post: Post) => {
    if (deletedPostIds.current.has(post.id)) return;
    incomingVersion.current += 1;
    incomingPosts.current.set(post.id, { version: incomingVersion.current, post });
    commitPosts(mergePosts(postsRef.current, [post]));
    if (selectedPostId.current === post.id) setSelectedPost(post);
    markArrival(post.id);
  }, [commitPosts, markArrival]);

  const refreshPosts = useCallback(async (resetPagination = true) => {
    const client = supabase;
    if (!client) return;

    const requestId = ++feedRequestId.current;
    const versionAtStart = incomingVersion.current;
    setFeedError(false);
    setOlderError(false);
    setIsLoadingOlder(false);
    setIsInitialLoading(postsRef.current.length === 0);
    setIsRefreshing(postsRef.current.length > 0);

    try {
      const selectedId = selectedPostId.current;
      const [latestPosts, selectedPostResult] = await Promise.all([
        loadLatestPosts(client),
        selectedId ? loadPostById(client, selectedId).catch(() => undefined) : Promise.resolve(undefined),
      ]);
      if (!active.current || requestId !== feedRequestId.current) return;
      if (selectedId && selectedPostResult === null) removePost(selectedId);
      else if (selectedPostResult && selectedPostId.current === selectedId) setSelectedPost(selectedPostResult);

      const arrivalsDuringRequest = [...incomingPosts.current.values()]
        .filter(({ version }) => version > versionAtStart)
        .map(({ post }) => post);
      const refreshedPosts = mergePosts(latestPosts, arrivalsDuringRequest);
      commitPosts(
        resetPagination
          ? refreshedPosts
          : mergePosts(postsRef.current, refreshedPosts),
      );
      incomingPosts.current.clear();
      setHasOlder((current) =>
        resetPagination ? latestPosts.length === PAGE_SIZE : current || latestPosts.length === PAGE_SIZE,
      );
    } catch {
      if (!active.current || requestId !== feedRequestId.current) return;
      setFeedError(true);
    } finally {
      if (active.current && requestId === feedRequestId.current) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [commitPosts, removePost]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    active.current = true;
    const channel = client
      .channel("public-posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => receivePost(payload.new as Post),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, (payload) => receivePost(payload.new as Post))
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => removePost((payload.old as { id?: string }).id ?? ""),
      )
      .subscribe((status) => {
        if (!active.current) return;

        if (status === "SUBSCRIBED") {
          setRealtimeState("connected");
          if (initialFetchStarted.current) void refreshPosts(true);
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setRealtimeState("disconnected");
        }
      });

    initialFetchStarted.current = true;
    // Defer the read until after subscribing; a second read on SUBSCRIBED closes the race.
    queueMicrotask(() => {
      if (active.current) void refreshPosts(true);
    });

    return () => {
      active.current = false;
      feedRequestId.current += 1;
      if (arrivalTimer.current !== null) window.clearTimeout(arrivalTimer.current);
      void client.removeChannel(channel);
    };
  }, [receivePost, refreshPosts, removePost]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || submitInFlight.current) return;

    const validationError = validatePostBody(draft);
    if (validationError) {
      setFeedback({ kind: "error", text: validationError });
      return;
    }

    submitInFlight.current = true;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      let imagePath = pendingImagePath.current;
      if (selectedImage && !imagePath) {
        setIsUploadingImage(true);
        try {
          imagePath = await uploadPostImage(
            supabase,
            createPostImagePath(selectedImage),
            selectedImage,
          );
          pendingImagePath.current = imagePath;
        } finally {
          setIsUploadingImage(false);
        }
      }
      const body = draft.trim();
      const pending = pendingPost.current;
      const token = pending?.body === body && pending.imagePath === (imagePath ?? null)
        ? pending.token
        : createPostDeleteToken();
      pendingPost.current = { body, imagePath: imagePath ?? null, token };
      const post = await createPost(supabase, draft, imagePath ?? undefined, token);
      pendingPost.current = null;
      receivePost(post);
      setDraft("");
      clearSelectedImage();
      setFeedback({ kind: "success", text: "Your post was shared." });
      textareaRef.current?.focus();
    } catch {
      setFeedback({
        kind: "error",
        text: "Your post couldn’t be shared. Your draft is still here; try again when you’re ready.",
      });
    } finally {
      submitInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const handleLoadOlder = async () => {
    const client = supabase;
    const oldestPost = postsRef.current.at(-1);
    if (!client || !oldestPost || !hasOlder || isLoadingOlder) return;

    const requestId = feedRequestId.current;
    setIsLoadingOlder(true);
    setOlderError(false);

    try {
      const olderPosts = await loadOlderPosts(client, oldestPost);
      if (!active.current || requestId !== feedRequestId.current) return;

      commitPosts(mergePosts(postsRef.current, olderPosts));
      if (olderPosts.length < PAGE_SIZE) setHasOlder(false);
    } catch {
      if (!active.current || requestId !== feedRequestId.current) return;
      setOlderError(true);
    } finally {
      if (active.current && requestId === feedRequestId.current) {
        setIsLoadingOlder(false);
      }
    }
  };

  const characterCount = countCharacters(draft);
  const isOverLimit = characterCount > 280;
  const isShareDisabled =
    !supabase || !draft.trim() || isOverLimit || isSubmitting;

  return (
    <>
      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-top">
          <ProfileAvatar profile={profile} />
          <div className="composer-identity">
            <label htmlFor="draft">What’s on your mind?</label>
            <p>Posting publicly as <strong>{profile.display_name}</strong></p>
          </div>
        </div>

        <div className="composer-input-shell">
        <textarea
          id="draft"
          ref={textareaRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setFeedback(null);
          }}
          aria-describedby="posting-note counter"
          aria-invalid={isOverLimit}
          disabled={!supabase || isSubmitting}
          placeholder={supabase ? "Share a thought, a small update, anything…" : "The wall isn’t available right now."}
        />
        <input
              ref={imageInputRef}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="image-note"
              aria-invalid={Boolean(imageError)}
              disabled={!supabase || isSubmitting}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                const error = validatePostImage(file);
                if (error) {
                  setImageError(error);
                  return;
                }
                clearSelectedImage();
                const previewUrl = URL.createObjectURL(file);
                imagePreviewUrl.current = previewUrl;
                setSelectedImage(file);
                setImagePreview(previewUrl);
              }}
            />
        <button className="composer-image-button" type="button" aria-label="Attach image" title="Attach image" disabled={!supabase || isSubmitting} onClick={() => imageInputRef.current?.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8" cy="8" r="1.5" />
            <path d="m3 17 5-5 4 4 4-6 5 7" />
          </svg>
        </button>
        <span className="sr-only" id="image-note">JPEG, PNG, or WebP · up to {MAX_POST_IMAGE_BYTES / (1024 * 1024)} MB</span>
        </div>
        <p className="hint" id="posting-note">
          {supabase
            ? "No sign-in needed. Up to 280 characters."
            : "Posts are temporarily unavailable."}
        </p>
        {imageError && <p className="image-error" role="status" aria-live="polite">{imageError}</p>}
        {imagePreview && (
          <div className="image-preview">
            {/* Native img displays a local object URL preview without uploading it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Selected photo preview" width={640} height={480} />
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              onClick={clearSelectedImage}
            >
              Remove photo
            </Button>
          </div>
        )}
        <div className="composer-bottom">
          <span className={`count${isOverLimit ? " count-error" : ""}`} id="counter">
            {characterCount} / 280 characters
          </span>
          <Button type="submit" size="lg" className="share-button" disabled={isShareDisabled}>
            {isUploadingImage ? "Uploading photo…" : isSubmitting ? "Sharing…" : "Share"}
          </Button>
        </div>
        {feedback && (
          <p className={feedback.kind === "success" ? "sr-only" : `message ${feedback.kind}`} role="status" aria-live="polite">
            {feedback.text}
          </p>
        )}
      </form>

      <section className="feed-section" aria-labelledby="feed-title">
        <div className="feed-heading">
            <h2 id="feed-title" tabIndex={-1}>Recent posts</h2>
          <div className="feed-meta">
            <span>Newest first</span>
            {supabase && realtimeState !== "connected" && (
              <span className={`connection-status ${realtimeState}`} aria-live="polite">
                {realtimeState === "disconnected" ? "Live updates paused" : "Connecting"}
              </span>
            )}
          </div>
        </div>

        <div className="feed-list" aria-busy={isInitialLoading || isRefreshing || isLoadingOlder}>
          {realtimeState === "disconnected" && !isInitialLoading && (
            <div className="feed-alert" role="status">
              <span>
                {posts.length > 0
                  ? "Live updates are paused. Your visible posts are still here."
                  : "Live updates are paused. Refresh the wall to check for posts."}
              </span>
              {!feedError && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={isRefreshing}
                  onClick={() => void refreshPosts(true)}
                >
                  {isRefreshing ? "Refreshing…" : "Refresh wall"}
                </Button>
              )}
            </div>
          )}
          {!supabase ? (
            <FeedState title="The wall isn’t connected yet." detail="Posts will appear here once the wall is available." />
          ) : isInitialLoading && posts.length === 0 ? (
            <FeedState title="Loading the wall…" detail="Recent posts will appear here." />
          ) : feedError && posts.length === 0 ? (
            <FeedState
              title="The wall couldn’t load."
              detail="Your draft is safe. Try refreshing the posts."
              action={<Button type="button" variant="outline" size="lg" onClick={() => void refreshPosts(true)}>Retry</Button>}
            />
          ) : posts.length === 0 ? (
            <FeedState title="The wall is waiting." detail="Be the first to leave a thought." />
          ) : (
            <>
              {feedError && (
                <div className="feed-alert error-alert" role="status">
                  <span>The wall couldn’t refresh. Your visible posts are still here.</span>
                  <Button type="button" variant="outline" size="lg" onClick={() => void refreshPosts(true)}>
                    Retry
                  </Button>
                </div>
              )}
              {isRefreshing && <p className="refresh-note" role="status">Refreshing the wall…</p>}
              <PostActivityProvider posts={posts}>
                {posts.map((post) => <PostCard key={post.id} post={post} profile={profile} arriving={arrivingPostId === post.id} onOpenDetails={openPost} onDeleted={removePost} onEdited={receivePost} />)}
                {selectedPost && <PostDetailDialog post={selectedPost} profile={profile} deleted={selectedPostDeleted} onClose={closePost} onDeleted={removePost} onEdited={receivePost} />}
              </PostActivityProvider>
              {olderError && (
                <div className="feed-alert error-alert" role="status">
                  <span>Older posts couldn’t load. Your wall is still here.</span>
                  <Button type="button" variant="outline" size="lg" onClick={() => void handleLoadOlder()}>
                    Try again
                  </Button>
                </div>
              )}
              {hasOlder && (
                <div className="load-older-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="secondary-button"
                    disabled={isLoadingOlder}
                    onClick={() => void handleLoadOlder()}
                  >
                    {isLoadingOlder ? "Loading older posts…" : "Load older posts"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

function FeedState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="feed-state" role="status">
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  );
}
