"use client";

export type AppNotice = {
  id: number;
  tone: "ok" | "err" | "warn";
  message: string;
};

export const APP_NOTICE_EVENT = "oldes-notice";

export function announce(tone: AppNotice["tone"], message: string) {
  const text = message.trim();
  if (!text || typeof window === "undefined") return;
  const detail: AppNotice = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    tone,
    message: text,
  };
  window.dispatchEvent(new CustomEvent(APP_NOTICE_EVENT, { detail }));
}

export function announceError(message: string) {
  announce("err", message);
}

export function announceSuccess(message: string) {
  announce("ok", message);
}

export function announceWarn(message: string) {
  announce("warn", message);
}
