"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import ProfileAvatar from "@/components/profile-avatar";
import ProfilePhotoCropper from "@/components/profile-photo-cropper";
import ConfirmationDialog from "@/components/confirmation-dialog";
import type { SharedProfile } from "@/lib/profile";
import { MAX_POST_IMAGE_BYTES, validatePostImage } from "@/lib/posts";

export default function ProfilePhotoPicker({
  profile,
  photoUrl,
  disabled,
  hasPhoto,
  onSelectPhoto,
  onRemovePhoto,
}: {
  profile: SharedProfile;
  photoUrl?: string | null;
  disabled: boolean;
  hasPhoto: boolean;
  onSelectPhoto: (file: File) => boolean;
  onRemovePhoto: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const activeStream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);

  const releaseStream = () => {
    activeStream.current?.getTracks().forEach((track) => track.stop());
    activeStream.current = null;
    setStream(null);
    setCameraReady(false);
  };

  const stopCamera = () => {
    cameraRequest.current += 1;
    releaseStream();
    setCameraOpen(false);
    setCameraError("");
    setIsCapturing(false);
  };

  useEffect(() => {
    const videoElement = video.current;
    if (!stream || !videoElement) return;
    let disposed = false;
    videoElement.srcObject = stream;
    void videoElement.play().catch(() => {
      if (disposed || activeStream.current !== stream) return;
      stream.getTracks().forEach((track) => track.stop());
      activeStream.current = null;
      setStream(null);
      setCameraReady(false);
      setCameraError("Camera preview couldn’t start. You can upload a photo instead.");
    });
    return () => {
      disposed = true;
      videoElement.srcObject = null;
    };
  }, [stream]);

  useEffect(() => () => {
    cameraRequest.current += 1;
    activeStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const chooseUpload = () => {
    stopCamera();
    setMenuOpen(false);
    fileInput.current?.click();
  };

  const beginCrop = (file: File) => {
    const validationError = validatePostImage(file);
    if (validationError) {
      setFileError(validationError);
      setMenuOpen(true);
      return;
    }
    setFileError("");
    setMenuOpen(false);
    setCropFile(file);
  };

  const startCamera = async () => {
    const requestId = ++cameraRequest.current;
    setMenuOpen(false);
    setCameraOpen(true);
    setCameraReady(false);
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access isn’t available here. You can upload a photo instead.");
      return;
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (requestId !== cameraRequest.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      activeStream.current = nextStream;
      setStream(nextStream);
    } catch {
      if (requestId === cameraRequest.current) {
        setCameraError("Couldn’t open the camera. Check permission or upload a photo instead.");
      }
    }
  };

  const capturePhoto = async () => {
    const videoElement = video.current;
    if (!videoElement?.videoWidth || !videoElement.videoHeight) return;
    const requestId = cameraRequest.current;

    const scale = Math.min(1, 1200 / Math.max(videoElement.videoWidth, videoElement.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(videoElement.videoWidth * scale);
    canvas.height = Math.round(videoElement.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      releaseStream();
      setCameraError("Couldn’t capture the photo. You can upload one instead.");
      return;
    }
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    releaseStream();
    setIsCapturing(true);

    try {
      let photo: Blob | null = null;
      for (const quality of [0.85, 0.7, 0.55]) {
        photo = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (requestId !== cameraRequest.current) return;
        if (photo && photo.size <= MAX_POST_IMAGE_BYTES) break;
      }
      if (!photo || photo.size > MAX_POST_IMAGE_BYTES) {
        setCameraError("The photo is too large. Try again or upload a smaller one.");
        setIsCapturing(false);
        return;
      }
      const file = new File([photo], "profile-photo.jpg", { type: "image/jpeg" });
      if (requestId !== cameraRequest.current) return;
      beginCrop(file);
      stopCamera();
    } catch {
      if (requestId !== cameraRequest.current) return;
      setCameraError("Couldn’t capture the photo. You can upload one instead.");
      setIsCapturing(false);
    }
  };

  return (
    <div className="profile-photo-picker">
      <button
        ref={trigger}
        className="profile-photo-trigger"
        type="button"
        aria-label="Change profile photo"
        aria-expanded={menuOpen}
        aria-controls="profile-photo-options"
        disabled={disabled}
        onClick={() => {
          if (cameraOpen) stopCamera();
          setMenuOpen((open) => !open);
        }}
      >
        <ProfileAvatar profile={profile} className="profile-avatar" photoUrl={photoUrl} />
        <span className="profile-camera-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4z" />
            <circle cx="12" cy="13" r="3.2" />
          </svg>
        </span>
      </button>

      {menuOpen && (
        <div className="profile-photo-actions profile-photo-options" id="profile-photo-options" role="group" aria-label="Profile photo options">
          <Button type="button" variant="outline" size="lg" disabled={disabled} onClick={chooseUpload}>Upload photo</Button>
          <Button type="button" variant="outline" size="lg" disabled={disabled} onClick={() => void startCamera()}>Take a photo</Button>
          {fileError && <p className="camera-error" role="alert">{fileError}</p>}
          <p className="profile-photo-hint">JPEG, PNG, or WebP · up to 2 MB. Save your profile to apply the photo.</p>
          {hasPhoto && (
            <button
              type="button"
              className="profile-photo-remove-action"
              disabled={disabled}
              onClick={() => { stopCamera(); setMenuOpen(false); setConfirmRemoval(true); }}
            >
              Remove photo
            </button>
          )}
        </div>
      )}

      {cameraOpen && (
        <div className="profile-camera-panel" role="group" aria-label="Take a profile photo">
          {stream ? (
            <video
              ref={video}
              autoPlay
              muted
              playsInline
              aria-label="Live camera preview"
              onCanPlay={() => setCameraReady(true)}
            />
          ) : cameraError ? null : <p role="status">{isCapturing ? "Preparing photo…" : "Opening camera…"}</p>}
          {cameraError && <p className="camera-error" role="alert">{cameraError}</p>}
          <div className="profile-photo-actions profile-camera-actions">
            {cameraError && <Button type="button" variant="outline" size="lg" disabled={disabled} onClick={chooseUpload}>Upload photo</Button>}
            <Button type="button" size="lg" disabled={disabled || !cameraReady || isCapturing} onClick={() => void capturePhoto()}>Capture photo</Button>
            <Button type="button" variant="outline" size="lg" disabled={disabled} onClick={stopCamera}>Cancel camera</Button>
          </div>
        </div>
      )}

      {confirmRemoval && (
        <ConfirmationDialog
          title="Remove profile photo?"
          description="Your profile will show initials instead. Save your profile to apply this change."
          confirmLabel="Remove photo"
          onCancel={() => { setConfirmRemoval(false); trigger.current?.focus(); }}
          onConfirm={() => { setConfirmRemoval(false); onRemovePhoto(); trigger.current?.focus(); }}
        />
      )}
      {cropFile && (
        <ProfilePhotoCropper
          key={cropFile.name + cropFile.lastModified}
          file={cropFile}
          onCancel={() => { setCropFile(null); trigger.current?.focus(); }}
          onConfirm={(photo) => { if (onSelectPhoto(photo)) setCropFile(null); trigger.current?.focus(); }}
        />
      )}
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Upload a profile photo"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) beginCrop(file);
        }}
      />
    </div>
  );
}
