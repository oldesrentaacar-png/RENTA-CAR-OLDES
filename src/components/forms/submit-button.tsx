"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className,
  variant = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} className={cn(className)}>
      {pending ? "Guardando…" : children}
    </Button>
  );
}
