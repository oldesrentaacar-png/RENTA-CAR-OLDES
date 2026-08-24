"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";

import { refreshAlerts } from "@/app/dashboard/alertas/actions";
import { Button } from "@/components/ui/button";

export function AlertActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await refreshAlerts();
          router.refresh();
        });
      }}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      Actualizar alertas
    </Button>
  );
}
