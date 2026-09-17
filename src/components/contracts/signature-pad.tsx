"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SignaturePadProps = {
  onConfirm: (dataUrl: string) => void;
  disabled?: boolean;
  className?: string;
};

export function SignaturePad({ onConfirm, disabled, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Fixed bitmap size; CSS scales for display.
    canvas.width = 640;
    canvas.height = 220;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  useEffect(() => {
    prepareCanvas();
  }, [prepareCanvas]);

  const getPoint = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      const point = getPoint(event);
      if (!canvas || !point) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      // Dot counts as a stroke so "Confirmar" enables after a tap.
      ctx.lineTo(point.x + 0.01, point.y + 0.01);
      ctx.stroke();
      setHasStroke(true);
    },
    [disabled, getPoint],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || disabled) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      const point = getPoint(event);
      if (!canvas || !point) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      setHasStroke(true);
    },
    [disabled, getPoint],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      drawingRef.current = false;
      try {
        canvasRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    },
    [],
  );

  const clear = useCallback(() => {
    prepareCanvas();
    setHasStroke(false);
  }, [prepareCanvas]);

  const confirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke || disabled) return;
    onConfirm(canvas.toDataURL("image/png"));
  }, [disabled, hasStroke, onConfirm]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <canvas
          ref={canvasRef}
          className="h-44 w-full touch-none cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <p className="text-xs text-muted">
        Dibuje con el dedo o el mouse y luego pulse <strong>Confirmar firma</strong>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={clear} disabled={disabled}>
          Limpiar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={confirm}
          disabled={disabled || !hasStroke}
        >
          Confirmar firma
        </Button>
      </div>
    </div>
  );
}
