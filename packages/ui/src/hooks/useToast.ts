"use client";

import { useState, useCallback } from "react";

export type ToastVariant = "default" | "destructive" | "success";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  toast: (opts: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

// Simple module-level toast store — sufficient for non-concurrent usage
const listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

const notify = (): void => {
  for (const l of listeners) l([...toasts]);
};

export const addToast = (opts: Omit<Toast, "id">): string => {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { ...opts, id }];
  notify();
  // Auto-dismiss after 5s
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 5000);
  return id;
};

export const dismissToast = (id: string): void => {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
};

export const useToast = (): ToastState => {
  const [localToasts, setLocalToasts] = useState<Toast[]>([...toasts]);

  // Subscribe on each render — React 18 will batch; safe for our use case
  const subscribe = useCallback((cb: (t: Toast[]) => void) => {
    listeners.push(cb);
    return (): void => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  // Re-subscribe when component mounts
  useState(() => subscribe(setLocalToasts));

  return {
    toasts: localToasts,
    toast: (opts) => { addToast(opts); },
    dismiss: dismissToast,
  };
};
