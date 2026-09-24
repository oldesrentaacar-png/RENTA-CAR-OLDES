"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

/** Aviso flotante: hay más campos abajo (fotos, km, firma). */
export function ScrollHint({ message }: { message: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const update = () => {
      const overflow = main.scrollHeight - main.clientHeight > 72;
      const nearBottom =
        main.scrollTop + main.clientHeight >= main.scrollHeight - 56;
      setVisible(overflow && !nearBottom);
    };

    update();
    const timer = window.setTimeout(update, 350);
    main.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(timer);
      main.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const main = document.querySelector("main");
        if (!main) return;
        main.scrollBy({
          top: Math.max(220, Math.round(main.clientHeight * 0.65)),
          behavior: "smooth",
        });
      }}
      className="fixed bottom-[calc(5.4rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-left text-sm font-medium text-amber-950 shadow-md md:bottom-6"
    >
      <ChevronDown className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </button>
  );
}

/** Mensaje verde breve cuando una acción sí quedó hecha. */
export function FlowToast({
  message,
  tick,
}: {
  message: string | null;
  tick: number;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    setText(message);
    const timer = window.setTimeout(() => setText(null), 3200);
    return () => window.clearTimeout(timer);
  }, [message, tick]);

  if (!text) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 top-16 z-50 max-w-[92vw] -translate-x-1/2 rounded-full bg-emerald-800 px-4 py-2 text-center text-sm font-medium text-white shadow-lg"
    >
      {text}
    </div>
  );
}

/** Aviso amarillo con lo que falta, sin bloquear la salida. */
export function MissingFieldsBanner({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">Falta esto para poder cerrar:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
