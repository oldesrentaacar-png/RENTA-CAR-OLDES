"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { disableUser } from "@/app/dashboard/usuarios/actions";
import { Button } from "@/components/ui/button";

export function DisableUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <Button
        type="button"
        variant="danger"
        onClick={async () => {
          if (!confirm("¿Desactivar este usuario?")) return;
          const result = await disableUser(userId);
          if (!result.success) setError(result.error);
          else router.refresh();
        }}
      >
        Desactivar usuario
      </Button>
    </div>
  );
}
