"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ProfilePhotoCropper({
  file,
  onConfirm,
  onCancel,
}: {
  file: File;
  onConfirm: (photo: File) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef(true);
  const drag = useRef<{ id: number; x: number; y: number; horizontal: number; vertical: number; size: number; width: number; rangeX: number; rangeY: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    const url = URL.createObjectURL(file);
    const source = new Image();
    source.onload = () => { if (active.current) setImage(source); };
    source.onerror = () => { if (active.current) setError("This image couldn’t be opened. Choose another photo."); };
    source.src = url;
    return () => {
      active.current = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!image) return;
    const context = canvas.current?.getContext("2d");
    if (!context) {
      setError("The crop preview couldn’t open. Please try another browser.");
      return;
    }
    const size = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const x = (image.naturalWidth - size) * horizontal / 100;
    const y = (image.naturalHeight - size) * vertical / 100;
    context.clearRect(0, 0, 512, 512);
    context.drawImage(image, x, y, size, size, 0, 0, 512, 512);
  }, [image, zoom, horizontal, vertical]);

  const confirm = () => {
    if (!image || !canvas.current || working) return;
    setWorking(true);
    // Preview, upload and every avatar use this same lossless square image.
    canvas.current.toBlob((blob) => {
      if (!active.current) return;
      if (!blob) {
        setError("The cropped photo couldn’t be prepared. Try again.");
        setWorking(false);
        return;
      }
      dialog.current?.close();
      onConfirm(new File([blob], "profile-photo.png", { type: "image/png" }));
      setWorking(false);
    }, "image/png");
  };

  const cancel = () => {
    dialog.current?.close();
    onCancel();
  };

  const clampPosition = (value: number) => Math.max(0, Math.min(100, value));

  return (
    <dialog
      ref={dialog}
      className="profile-crop-dialog"
      aria-labelledby="profile-crop-title"
      aria-describedby="profile-crop-note"
      onCancel={(event) => { event.preventDefault(); cancel(); }}
    >
      <h2 id="profile-crop-title">Crop your profile photo</h2>
      <p id="profile-crop-note">Drag the photo to position it. Use the zoom buttons to adjust the crop.</p>
      {error ? <p role="alert">{error}</p> : (
        <div className="profile-crop-stage">
          <canvas
            ref={canvas}
            width={512}
            height={512}
            tabIndex={0}
            role="img"
            aria-label="Profile photo crop preview. Drag or use arrow keys to move the photo."
            onPointerDown={(event) => {
              if (!image || working || event.button !== 0 || drag.current) return;
              event.preventDefault();
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              const size = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
              drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal, vertical, size, width: event.currentTarget.getBoundingClientRect().width, rangeX: image.naturalWidth - size, rangeY: image.naturalHeight - size };
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (!start || start.id !== event.pointerId || working) return;
              const scale = start.size / start.width;
              if (start.rangeX > 0) setHorizontal(clampPosition(start.horizontal - (event.clientX - start.x) * scale / start.rangeX * 100));
              if (start.rangeY > 0) setVertical(clampPosition(start.vertical - (event.clientY - start.y) * scale / start.rangeY * 100));
            }}
            onPointerUp={(event) => {
              if (drag.current?.id !== event.pointerId) return;
              drag.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { drag.current = null; }}
            onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={(event) => {
              if (!image || working || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
              event.preventDefault();
              const step = event.shiftKey ? 10 : 2;
              if (event.key === "ArrowLeft") setHorizontal((value) => clampPosition(value + step));
              if (event.key === "ArrowRight") setHorizontal((value) => clampPosition(value - step));
              if (event.key === "ArrowUp") setVertical((value) => clampPosition(value + step));
              if (event.key === "ArrowDown") setVertical((value) => clampPosition(value - step));
            }}
          />
          {!image && <span role="status">Opening photo…</span>}
        </div>
      )}
      <div className="profile-crop-zoom" role="group" aria-label="Photo zoom">
        <Button type="button" variant="outline" aria-label="Zoom out" disabled={!image || working || zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.25))}>−</Button>
        <output aria-live="polite">{Math.round(zoom * 100)}%</output>
        <Button type="button" variant="outline" aria-label="Zoom in" disabled={!image || working || zoom >= 4} onClick={() => setZoom((value) => Math.min(4, value + 0.25))}>+</Button>
      </div>
      <p className="profile-crop-keyboard-hint">You can also focus the photo and use the arrow keys to move it.</p>
      <div className="profile-crop-actions">
        <Button type="button" variant="outline" onClick={cancel}>Cancel crop</Button>
        <Button type="button" disabled={!image || Boolean(error) || working} onClick={confirm}>{working ? "Preparing…" : "Use photo"}</Button>
      </div>
    </dialog>
  );
}
