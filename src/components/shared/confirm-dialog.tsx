"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary",
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} size="sm">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={busy || loading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={variant === "danger" ? "danger" : "primary"}
          loading={busy || loading}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
