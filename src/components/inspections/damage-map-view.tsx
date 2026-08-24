"use client";

import { useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import {
  DamageMap2D,
  type DamageMarkDraft,
} from "@/components/inspections/damage-map-2d";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DamageMapViewProps = {
  marks: DamageMarkDraft[];
  onChange: (marks: DamageMarkDraft[]) => void;
  readOnly?: boolean;
  highlightOnly?: boolean;
  className?: string;
  /** @deprecated 3D removed — always uses 2D schematic */
  defaultMode?: "3d" | "2d";
  vehiclePhotoUrl?: string | null;
  viewPhotos?: Partial<
    Record<"TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT", string>
  >;
  vehicleCategory?: string | null;
  vehicleModel?: string | null;
};

/**
 * Solo esquema 2D (papel) — vista 3D retirada a petición del cliente.
 */
export function DamageMapView({
  marks,
  onChange,
  readOnly,
  highlightOnly,
  className,
  viewPhotos,
  vehicleCategory,
  vehicleModel,
}: DamageMapViewProps) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div
      className={cn(
        "space-y-4",
        fullscreen &&
          "fixed inset-0 z-[200] overflow-auto bg-white p-4 md:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Esquema del vehículo — marque rayones / golpes / faltantes
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setFullscreen((value) => !value)}
        >
          {fullscreen ? (
            <>
              <Minimize2 className="mr-1 h-4 w-4" />
              Salir pantalla completa
            </>
          ) : (
            <>
              <Maximize2 className="mr-1 h-4 w-4" />
              Pantalla completa
            </>
          )}
        </Button>
      </div>

      <DamageMap2D
        marks={marks}
        onChange={onChange}
        readOnly={readOnly}
        highlightOnly={highlightOnly}
        viewPhotos={viewPhotos}
        vehicleCategory={vehicleCategory}
        vehicleModel={vehicleModel}
      />
    </div>
  );
}
