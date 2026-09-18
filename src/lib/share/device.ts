/** Helpers for download / WhatsApp that work on phone, tablet and desktop. */

export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS desktop UA
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isMobileOrTablet(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isAppleTouchDevice()) return true;
  return /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || "",
  );
}

/**
 * Save a PDF on any device:
 * - Desktop/Android: triggers download
 * - iOS: opens PDF (Save/Share from the viewer) or native share sheet when available
 */
export async function savePdfCrossDevice(file: File): Promise<"downloaded" | "shared" | "opened"> {
  const objectUrl = URL.createObjectURL(file);

  try {
    if (
      isAppleTouchDevice() &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: file.name,
        });
        return "shared";
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err;
        }
        // fall through to open
      }
    }

    if (isAppleTouchDevice()) {
      const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        window.location.href = objectUrl;
      }
      return "opened";
    }

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.name;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return "downloaded";
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

/**
 * Open WhatsApp chat with prefilled text.
 * Avoids popup blockers after async work (common on mobile).
 */
export function openWhatsAppCrossDevice(waUrl: string): void {
  if (!waUrl) return;

  if (isMobileOrTablet()) {
    // Same-tab navigation reliably opens the WhatsApp app on phones/tablets.
    window.location.assign(waUrl);
    return;
  }

  const opened = window.open(waUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    // Popup blocked → same tab fallback
    window.location.assign(waUrl);
  }
}
