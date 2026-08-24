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

  const getPoint = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ("touches" in event) {
        const touch = event.touches[0];
        if (!touch) return null;
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }

      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const startDrawing = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      const point = getPoint(event);
      if (!canvas || !point) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      drawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    },
    [disabled, getPoint],
  );

  const draw = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (!drawingRef.current || disabled) return;
      event.preventDefault();

      const canvas = canvasRef.current;
      const point = getPoint(event);
      if (!canvas || !point) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      setHasStroke(true);
    },
    [disabled, getPoint],
  );

  const stopDrawing = useCallback(() => {
    drawingRef.current = false;
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }, []);

  const confirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    onConfirm(canvas.toDataURL("image/png"));
  }, [hasStroke, onConfirm]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 640;
    canvas.height = 220;
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <canvas
          ref={canvasRef}
          className="h-44 w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
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
