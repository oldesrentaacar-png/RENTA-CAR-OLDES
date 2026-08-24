"use client";

import {
  PANEL_VIEWBOX,
  STROKE,
  FILL,
  getCarPaths,
  getPanelsForBody,
  type VehicleBodyStyle,
} from "@/lib/inspections/vehicle-panel-map";

type VehiclePanelSilhouetteProps = {
  bodyStyle?: VehicleBodyStyle;
};

/** Diagrama vista superior tipo formulario físico (silueta de carro real). */
export function VehiclePanelSilhouette({
  bodyStyle = "PICKUP",
}: VehiclePanelSilhouetteProps) {
  const paths = getCarPaths(bodyStyle);
  const panels = getPanelsForBody(bodyStyle);

  return (
    <g>
      <text
        x={PANEL_VIEWBOX.width / 2}
        y={22}
        textAnchor="middle"
        fontSize={13}
        fill={STROKE}
        fontWeight={700}
        fontFamily="Arial, Helvetica, sans-serif"
      >
        CARRO SEDAN
      </text>

      <path d={paths.body} fill={FILL} stroke={STROKE} strokeWidth={2.4} />
      <path d={paths.bumperFront} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      <path d={paths.hood} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      <path d={paths.fenderFL} fill={FILL} stroke={STROKE} strokeWidth={1.4} />
      <path d={paths.fenderFR} fill={FILL} stroke={STROKE} strokeWidth={1.4} />
      <path d={paths.doorFL} fill={FILL} stroke={STROKE} strokeWidth={1.4} />
      <path d={paths.doorFR} fill={FILL} stroke={STROKE} strokeWidth={1.4} />
      <path d={paths.stepL} fill={FILL} stroke={STROKE} strokeWidth={1.3} />
      <path d={paths.stepR} fill={FILL} stroke={STROKE} strokeWidth={1.3} />
      <path d={paths.roof} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      <path d={paths.doorRL} fill={FILL} stroke={STROKE} strokeWidth={1.4} />
      <path d={paths.doorRR} fill={FILL} stroke={STROKE} strokeWidth={1.4} />
      <path d={paths.fenderRL} fill={FILL} stroke={STROKE} strokeWidth={1.4} />
      <path d={paths.fenderRR} fill={FILL} stroke={STROKE} strokeWidth={1.4} />
      <path d={paths.trunk} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      <path d={paths.bumperRear} fill={FILL} stroke={STROKE} strokeWidth={1.5} />

      {paths.wheels.map((w) => (
        <g key={`${w.cx}-${w.cy}`}>
          <circle
            cx={w.cx}
            cy={w.cy}
            r={w.r}
            fill="#fff"
            stroke={STROKE}
            strokeWidth={2.2}
          />
          <circle
            cx={w.cx}
            cy={w.cy}
            r={w.r * 0.45}
            fill="none"
            stroke={STROKE}
            strokeWidth={1.6}
          />
        </g>
      ))}

      {panels.map((panel) => (
        <text
          key={panel.id}
          x={panel.lx}
          y={panel.ly}
          textAnchor="middle"
          fontSize={panel.fontSize ?? 8}
          fill={STROKE}
          fontWeight={700}
          fontFamily="Arial, Helvetica, sans-serif"
        >
          {panel.label}
        </text>
      ))}
    </g>
  );
}

export { PANEL_VIEWBOX };
