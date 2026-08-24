"use client";

import {
  getPickupCadElements,
  PICKUP_VIEWBOX,
} from "@/lib/inspections/pickup-cad";
import type { DamageView } from "@/types/database";

export function PickupCadSilhouette({ view }: { view: DamageView }) {
  const elements = getPickupCadElements(view);

  return (
    <g>
      {elements.map((el, index) => {
        const key = `${el.type}-${index}`;
        if (el.type === "rect") {
          return (
            <rect
              key={key}
              x={el.x}
              y={el.y}
              width={el.w}
              height={el.h}
              rx={el.rx ?? 0}
              fill={el.fill}
              stroke={el.stroke === "none" ? undefined : el.stroke}
              strokeWidth={el.sw ?? 1}
            />
          );
        }
        if (el.type === "circle") {
          return (
            <circle
              key={key}
              cx={el.cx}
              cy={el.cy}
              r={el.r}
              fill={el.fill}
              stroke={el.stroke}
              strokeWidth={el.sw}
            />
          );
        }
        if (el.type === "line") {
          return (
            <line
              key={key}
              x1={el.x1}
              y1={el.y1}
              x2={el.x2}
              y2={el.y2}
              stroke={el.stroke}
              strokeWidth={el.sw ?? 1}
            />
          );
        }
        return (
          <path
            key={key}
            d={el.d}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.sw ?? 1}
          />
        );
      })}
    </g>
  );
}

export { PICKUP_VIEWBOX };
