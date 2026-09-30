"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SignaturePadProps = {
  onConfirm: (dataUrl: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Firma multi-trazo global (entrega, cierre, pagaré, perfil, usuarios).
 * Solo “Confirmar firma” entrega el dataURL — soltar el dedo NUNCA cierra la firma.
 */
export function SignaturePad({
  onConfirm,
  disabled,
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasStroke, setHasStroke] = useState(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 720;
    canvas.height = 280;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3.25;
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

  const endStroke = useCallback(() => {
    drawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      const point = getPoint(event);
      if (!canvas || !point) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      drawingRef.current = true;
      lastPointRef.current = point;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + 0.01, point.y + 0.01);
      ctx.stroke();
      hasStrokeRef.current = true;
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
      const prev = lastPointRef.current;
      if (prev) {
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      lastPointRef.current = point;
      hasStrokeRef.current = true;
      setHasStroke(true);
    },
    [disabled, getPoint],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      endStroke();
      try {
        canvasRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    },
    [endStroke],
  );

  const clear = useCallback(() => {
    prepareCanvas();
    hasStrokeRef.current = false;
    lastPointRef.current = null;
    drawingRef.current = false;
    setHasStroke(false);
  }, [prepareCanvas]);

  const confirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current || disabled) return;
    onConfirm(canvas.toDataURL("image/png"));
  }, [disabled, onConfirm]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border-2 border-border bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          className="h-52 w-full touch-none cursor-crosshair sm:h-56"
          style={{ touchAction: "none", WebkitUserSelect: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={endStroke}
        />
      </div>
      <p className="text-sm text-muted">
        Dibuje con el dedo. Puede levantar el dedo entre letras. Cuando termine,
        pulse <strong>Confirmar firma</strong>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={clear}
          disabled={disabled}
        >
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
