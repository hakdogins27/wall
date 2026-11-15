"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import WallNotifications, { useWallNotifications } from "@/components/wall-notifications";

export default function SiteNavigation({ currentPage }: { currentPage: "wall" | "profile" | "about" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const notificationDialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const notificationTrigger = useRef<HTMLButtonElement>(null);
  const outsidePointer = useRef<{ id: number; startOutside: boolean } | null>(null);
  const restoreMenuFocus = useRef(true);
  const [open, setOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const { unreadCount, markRead } = useWallNotifications();

  const close = (restoreFocus = true) => {
    restoreMenuFocus.current = restoreFocus;
    dialog.current?.close();
  };
  const closeNotifications = () => notificationDialog.current?.close();
  const openMenu = () => {
    restoreMenuFocus.current = true;
    dialog.current?.showModal();
    setOpen(true);
  };
  const openNotifications = () => {
    notificationDialog.current?.showModal();
    setNotificationDrawerOpen(true);
    markRead();
  };

  useEffect(() => {
    const element = notificationDrawerOpen ? notificationDialog.current : dialog.current;
    if (!element || (!open && !notificationDrawerOpen)) return;
    const isOutside = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.target !== element || !event.isPrimary || event.button !== 0) {
        outsidePointer.current = null;
        return;
      }
      outsidePointer.current = { id: event.pointerId, startOutside: isOutside(event) };
    };
    const pointerUp = (event: PointerEvent) => {
      const start = outsidePointer.current;
      outsidePointer.current = null;
      if (start?.id === event.pointerId && start.startOutside && isOutside(event)) element.close();
    };
    const pointerCancel = () => { outsidePointer.current = null; };
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerup", pointerUp, true);
    document.addEventListener("pointercancel", pointerCancel, true);
    return () => {
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointerup", pointerUp, true);
      document.removeEventListener("pointercancel", pointerCancel, true);
    };
  }, [open, notificationDrawerOpen]);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth > 1180) { if (dialog.current?.open) close(false); notificationDialog.current?.close(); }
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open && !notificationDrawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open, notificationDrawerOpen]);

  useEffect(() => {
    if (notificationDrawerOpen) markRead();
  }, [notificationDrawerOpen, markRead]);

  const closeAfterNavigation = () => { if (dialog.current?.open) close(); };
  const onClose = () => {
    setOpen(false);
    if (restoreMenuFocus.current) trigger.current?.focus();
    restoreMenuFocus.current = true;
  };
  const onNotificationClose = () => {
    setNotificationDrawerOpen(false);
    notificationTrigger.current?.focus();
  };
  const notificationLabel = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  return <>
    <nav className="site-nav" aria-label="Main navigation">
      <Link href="/" aria-current={currentPage === "wall" ? "page" : undefined}>Wall</Link>
      <Link href="/profile" prefetch={false} aria-current={currentPage === "profile" ? "page" : undefined}>Profile</Link>
      <Link href="/about" aria-current={currentPage === "about" ? "page" : undefined}>About Wall</Link>
    </nav>
    <Link className="header-notifications" href="/#notifications-title" prefetch={false} aria-label={notificationLabel} onClick={markRead}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>
      <span>Notifications</span>
      {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </Link>
    <button ref={notificationTrigger} type="button" className="mobile-notifications-trigger" aria-label={notificationLabel} aria-haspopup="dialog" aria-expanded={notificationDrawerOpen} aria-controls="notification-drawer" onClick={openNotifications}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>
      {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    <button ref={trigger} type="button" className="mobile-menu-trigger" aria-label="Open navigation menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-site-menu" onClick={openMenu}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span>
    </button>
    <dialog ref={dialog} id="mobile-site-menu" className="mobile-menu-dialog" aria-labelledby="mobile-menu-title" onClose={onClose}>
      <header className="mobile-menu-heading"><h2 id="mobile-menu-title">Menu</h2><button type="button" aria-label="Close menu" onClick={() => close()} autoFocus>×</button></header>
      <nav className="mobile-menu-links" aria-label="Mobile navigation">
        <Link href="/" aria-current={currentPage === "wall" ? "page" : undefined} onClick={closeAfterNavigation}>Wall</Link>
        <Link href="/profile" prefetch={false} aria-current={currentPage === "profile" ? "page" : undefined} onClick={closeAfterNavigation}>Profile</Link>
        <Link href="/profile#profile-details" prefetch={false} onClick={closeAfterNavigation}>About me</Link>
        <Link href="/about" aria-current={currentPage === "about" ? "page" : undefined} onClick={closeAfterNavigation}>About Wall</Link>
      </nav>
    </dialog>
    <dialog ref={notificationDialog} id="notification-drawer" className="notification-drawer" aria-labelledby="notification-drawer-title" onClose={onNotificationClose}>
      <header className="notification-drawer-heading">
        <h2 id="notification-drawer-title">Notifications</h2>
        <button type="button" aria-label="Close notifications" onClick={closeNotifications} autoFocus>×</button>
      </header>
      <div className="notification-drawer-content"><WallNotifications /></div>
    </dialog>
  </>;
}
