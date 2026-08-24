"use client";

import { OrbitControls, PerspectiveCamera, useTexture } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { Vector3, SRGBColorSpace } from "three";

import type { DamageMarkDraft } from "@/components/inspections/damage-map-2d";
import { DamageMarkPanel } from "@/components/inspections/damage-mark-panel";
import { Button } from "@/components/ui/button";
import {
  CAR_DIMENSIONS,
  getCarTotalHeight,
  markToWorldPosition,
  worldPointToMark,
} from "@/lib/inspections/damage-map-coords";
import { cn } from "@/lib/utils";

type DamageMap3DProps = {
  marks: DamageMarkDraft[];
  onChange: (marks: DamageMarkDraft[]) => void;
  readOnly?: boolean;
  highlightOnly?: boolean;
  className?: string;
  /** Foto principal o por cara del vehículo (Cloudinary). */
  vehiclePhotoUrl?: string | null;
  viewPhotos?: Partial<
    Record<"TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT", string>
  >;
};

function TexturedFace({
  url,
  position,
  rotation,
  size,
}: {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
}) {
  const texture = useTexture(url);
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={texture} metalness={0.15} roughness={0.65} />
    </mesh>
  );
}

function CarBody({
  onSurfaceClick,
  readOnly,
  vehiclePhotoUrl,
  viewPhotos,
}: {
  onSurfaceClick: (
    point: Vector3,
    normal: Vector3,
    event: ThreeEvent<MouseEvent>,
  ) => void;
  readOnly?: boolean;
  vehiclePhotoUrl?: string | null;
  viewPhotos?: DamageMap3DProps["viewPhotos"];
}) {
  const groupRef = useRef<Group>(null);
  const { width, length, bodyHeight, roofHeight, groundClearance, bedLengthRatio } =
    CAR_DIMENSIONS;
  const bedLength = length * bedLengthRatio;
  const cabLength = length - bedLength;
  const bodyY = groundClearance + bodyHeight / 2;
  const roofY = groundClearance + bodyHeight + roofHeight / 2;
  const wheelY = groundClearance * 0.55;
  const frontWheelZ = length / 2 - 0.85;
  const rearWheelZ = -length / 2 + 0.95;
  const wheelX = width / 2 + 0.08;
  const cabCenterZ = length / 2 - cabLength / 2;
  const bedCenterZ = -length / 2 + bedLength / 2;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (readOnly) return;
    event.stopPropagation();
    const point = event.point.clone();
    const normal =
      event.face?.normal
        .clone()
        .transformDirection(event.object.matrixWorld)
        .normalize() ?? new Vector3(0, 1, 0);
    onSurfaceClick(point, normal, event);
  }

  const paint = "#f1f5f9";
  const paintDark = "#cbd5e1";
  const accent = "#1e3a5f";
  const glass = "#1e293b";
  const leftUrl = viewPhotos?.LEFT ?? vehiclePhotoUrl ?? null;
  const rightUrl = viewPhotos?.RIGHT ?? null;
  const frontUrl = viewPhotos?.FRONT ?? null;
  const rearUrl = viewPhotos?.REAR ?? null;
  const topUrl = viewPhotos?.TOP ?? null;

  return (
    <group ref={groupRef}>
      {/* Cabin */}
      <mesh position={[0, bodyY, cabCenterZ]} onClick={handleClick}>
        <boxGeometry args={[width, bodyHeight, cabLength * 0.98]} />
        <meshStandardMaterial color={paint} metalness={0.25} roughness={0.4} />
      </mesh>
      {/* Cabin roof */}
      <mesh position={[0, roofY, cabCenterZ + 0.05]} onClick={handleClick}>
        <boxGeometry args={[width * 0.9, roofHeight, cabLength * 0.72]} />
        <meshStandardMaterial color={paintDark} metalness={0.3} roughness={0.45} />
      </mesh>
      {/* Open bed */}
      <mesh position={[0, bodyY * 0.85, bedCenterZ]} onClick={handleClick}>
        <boxGeometry args={[width * 0.96, bodyHeight * 0.72, bedLength * 0.95]} />
        <meshStandardMaterial color={paintDark} metalness={0.2} roughness={0.55} />
      </mesh>
      {/* Bed rails */}
      <mesh
        position={[-width / 2 + 0.06, bodyY + 0.15, bedCenterZ]}
        onClick={handleClick}
      >
        <boxGeometry args={[0.08, bodyHeight * 0.55, bedLength * 0.9]} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh
        position={[width / 2 - 0.06, bodyY + 0.15, bedCenterZ]}
        onClick={handleClick}
      >
        <boxGeometry args={[0.08, bodyHeight * 0.55, bedLength * 0.9]} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Windshield */}
      <mesh
        position={[0, bodyY + bodyHeight * 0.2, length / 2 + 0.02]}
        onClick={handleClick}
      >
        <boxGeometry args={[width * 0.88, bodyHeight * 0.42, 0.06]} />
        <meshStandardMaterial color={glass} metalness={0.85} roughness={0.12} />
      </mesh>
      {/* Tailgate */}
      <mesh
        position={[0, bodyY * 0.9, -length / 2 - 0.02]}
        onClick={handleClick}
      >
        <boxGeometry args={[width * 0.9, bodyHeight * 0.55, 0.08]} />
        <meshStandardMaterial color={paint} metalness={0.3} roughness={0.45} />
      </mesh>
      {/* Wheels */}
      {[
        [-wheelX, wheelY, frontWheelZ],
        [wheelX, wheelY, frontWheelZ],
        [-wheelX, wheelY, rearWheelZ],
        [wheelX, wheelY, rearWheelZ],
      ].map(([x, y, z]) => (
        <mesh
          key={`${x}-${z}`}
          position={[x, y, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.36, 0.36, 0.26, 22]} />
          <meshStandardMaterial color="#111827" roughness={0.9} />
        </mesh>
      ))}

      {leftUrl ? (
        <TexturedFace
          url={leftUrl}
          position={[-width / 2 - 0.03, bodyY, cabCenterZ]}
          rotation={[0, -Math.PI / 2, 0]}
          size={[cabLength * 0.9, bodyHeight * 0.85]}
        />
      ) : null}
      {rightUrl ? (
        <TexturedFace
          url={rightUrl}
          position={[width / 2 + 0.03, bodyY, cabCenterZ]}
          rotation={[0, Math.PI / 2, 0]}
          size={[cabLength * 0.9, bodyHeight * 0.85]}
        />
      ) : null}
      {frontUrl ? (
        <TexturedFace
          url={frontUrl}
          position={[0, bodyY, length / 2 + 0.06]}
          rotation={[0, 0, 0]}
          size={[width * 0.9, bodyHeight * 0.8]}
        />
      ) : null}
      {rearUrl ? (
        <TexturedFace
          url={rearUrl}
          position={[0, bodyY * 0.9, -length / 2 - 0.06]}
          rotation={[0, Math.PI, 0]}
          size={[width * 0.9, bodyHeight * 0.7]}
        />
      ) : null}
      {topUrl ? (
        <TexturedFace
          url={topUrl}
          position={[0, roofY + roofHeight / 2 + 0.02, cabCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          size={[width * 0.85, cabLength * 0.7]}
        />
      ) : null}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </group>
  );
}

function ReferenceBillboard({ url }: { url: string }) {
  const texture = useTexture(url);
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[4.4, 1.55, 0]}>
      <planeGeometry args={[2.6, 1.7]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function DamageMarkers({
  marks,
  selectedIndex,
  highlightOnly,
  onSelect,
}: {
  marks: DamageMarkDraft[];
  selectedIndex: number | null;
  highlightOnly?: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <>
      {marks.map((mark, index) => {
        const [x, y, z] = markToWorldPosition(mark);
        const isSelected = index === selectedIndex;
        const color = highlightOnly
          ? "#dc2626"
          : isSelected
            ? "#2563eb"
            : "#ef4444";

        return (
          <group
            key={`${mark.markNumber}-${mark.view}-${mark.x}-${mark.y}`}
            position={[x, y, z]}
          >
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelect(index);
              }}
            >
              <sphereGeometry args={[isSelected ? 0.11 : 0.09, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.35}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Scene({
  marks,
  selectedIndex,
  highlightOnly,
  readOnly,
  vehiclePhotoUrl,
  viewPhotos,
  onSelect,
  onAddMark,
}: {
  marks: DamageMarkDraft[];
  selectedIndex: number | null;
  highlightOnly?: boolean;
  readOnly?: boolean;
  vehiclePhotoUrl?: string | null;
  viewPhotos?: DamageMap3DProps["viewPhotos"];
  onSelect: (index: number) => void;
  onAddMark: (draft: Omit<DamageMarkDraft, "markNumber">) => void;
}) {
  const cameraTarget = useMemo(
    () => new Vector3(0, getCarTotalHeight() * 0.45, 0),
    [],
  );

  const billboardUrl =
    vehiclePhotoUrl ||
    viewPhotos?.LEFT ||
    viewPhotos?.FRONT ||
    viewPhotos?.RIGHT ||
    viewPhotos?.REAR ||
    null;

  return (
    <>
      <PerspectiveCamera makeDefault position={[5.5, 3.2, 5.5]} fov={42} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} castShadow />
      <directionalLight position={[-4, 6, -3]} intensity={0.35} />
      <OrbitControls
        target={cameraTarget}
        enablePan={false}
        minDistance={5}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2.05}
      />
      <Suspense fallback={null}>
        <CarBody
          readOnly={readOnly}
          vehiclePhotoUrl={vehiclePhotoUrl}
          viewPhotos={viewPhotos}
          onSurfaceClick={(point, normal, event) => {
            if (readOnly) return;
            const mapped = worldPointToMark(
              point.x,
              point.y,
              point.z,
              normal.x,
              normal.y,
              normal.z,
            );
            onAddMark({
              view: mapped.view,
              x: mapped.x,
              y: mapped.y,
              damageType: "SCRATCH",
              severity: "LOW",
            });
            event.stopPropagation();
          }}
        />
        {billboardUrl ? <ReferenceBillboard url={billboardUrl} /> : null}
      </Suspense>
      <DamageMarkers
        marks={marks}
        selectedIndex={selectedIndex}
        highlightOnly={highlightOnly}
        onSelect={onSelect}
      />
    </>
  );
}

export function DamageMap3D({
  marks,
  onChange,
  readOnly,
  highlightOnly,
  className,
  vehiclePhotoUrl,
  viewPhotos,
}: DamageMap3DProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  function updateSelected(field: Partial<DamageMarkDraft>) {
    if (selectedIndex == null) return;
    onChange(
      marks.map((mark, index) =>
        index === selectedIndex ? { ...mark, ...field } : mark,
      ),
    );
  }

  function removeSelected() {
    if (selectedIndex == null) return;
    const next = marks
      .filter((_, index) => index !== selectedIndex)
      .map((mark, index) => ({ ...mark, markNumber: index + 1 }));
    onChange(next);
    setSelectedIndex(null);
  }

  function handleAddMark(draft: Omit<DamageMarkDraft, "markNumber">) {
    const next: DamageMarkDraft = {
      ...draft,
      markNumber: marks.length + 1,
    };
    onChange([...marks, next]);
    setSelectedIndex(marks.length);
  }

  const selected = selectedIndex != null ? marks[selectedIndex] : null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-slate-100 to-slate-200">
        <Canvas
          shadows
          className="h-[22rem] w-full touch-none"
          gl={{ antialias: true, alpha: true }}
        >
          <Scene
            marks={marks}
            selectedIndex={selectedIndex}
            highlightOnly={highlightOnly}
            readOnly={readOnly}
            vehiclePhotoUrl={vehiclePhotoUrl}
            viewPhotos={viewPhotos}
            onSelect={setSelectedIndex}
            onAddMark={handleAddMark}
          />
        </Canvas>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p>
          Arrastre para rotar · rueda del mouse para zoom
          {!readOnly ? " · clic en el vehículo para marcar daño" : ""}
          {vehiclePhotoUrl || viewPhotos
            ? " · foto del vehículo como referencia"
            : ""}
        </p>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSelectedIndex(null)}
          >
            Deseleccionar
          </Button>
        ) : null}
      </div>

      {selected && !readOnly ? (
        <DamageMarkPanel
          mark={selected}
          onChange={updateSelected}
          onRemove={removeSelected}
        />
      ) : null}
    </div>
  );
}
