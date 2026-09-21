"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  dismissAlertForMe,
  markAlertRead,
} from "@/app/dashboard/alertas/actions";

export function AlertRowActions({
  alertId,
  isRead,
}: {
  alertId: string;
  isRead: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!isRead ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await markAlertRead(alertId);
              router.refresh();
            });
          }}
          className="text-xs text-brand hover:underline disabled:opacity-50"
        >
          Leída
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await dismissAlertForMe(alertId);
            router.refresh();
          });
        }}
        className="text-xs font-medium text-zinc-800 hover:underline disabled:opacity-50"
      >
        Quitar
      </button>
    </div>
  );
}
