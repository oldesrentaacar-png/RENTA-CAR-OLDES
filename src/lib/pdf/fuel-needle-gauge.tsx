/**
 * Fuel gauge with needle for react-pdf (E … F, 9 steps).
 */
import { Circle, G, Line, Path, Svg, Text, View } from "@react-pdf/renderer";

const NAVY = "#0f2744";
const MUTED = "#64748b";
const ACCENT = "#c45c26";

export function PdfFuelNeedleGauge({
  label,
  activeIndex,
  width = 160,
}: {
  label: string;
  activeIndex: number;
  width?: number;
}) {
  const height = 78;
  const cx = width / 2;
  const cy = height - 8;
  const r = Math.min(width * 0.42, 58);
  const clamped =
    Number.isFinite(activeIndex) && activeIndex >= 0
      ? Math.min(8, Math.max(0, Math.round(activeIndex)))
      : -1;

  // Semicircle from left (E=180°) to right (F=0°)
  const angleFor = (index: number) => Math.PI - (index / 8) * Math.PI;
  const needleAngle = clamped >= 0 ? angleFor(clamped) : Math.PI / 2;
  const nx = cx + Math.cos(needleAngle) * (r - 10);
  const ny = cy - Math.sin(needleAngle) * (r - 10);

  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const ticks = Array.from({ length: 9 }).map((_, index) => {
    const a = angleFor(index);
    const x1 = cx + Math.cos(a) * (r - 2);
    const y1 = cy - Math.sin(a) * (r - 2);
    const x2 = cx + Math.cos(a) * (r - 8);
    const y2 = cy - Math.sin(a) * (r - 8);
    return { x1, y1, x2, y2, index };
  });

  return (
    <View style={{ marginTop: 4, alignItems: "center" }}>
      <Text
        style={{
          fontSize: 6.5,
          fontFamily: "Helvetica-Bold",
          color: NAVY,
          marginBottom: 2,
        }}
      >
        {label}
        {clamped >= 0
          ? ` · ${["E", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8", "F"][clamped]}`
          : ""}
      </Text>
      <Svg width={width} height={height}>
        <Path d={arcPath} stroke={NAVY} strokeWidth={2} fill="none" />
        {ticks.map((t) => (
          <Line
            key={t.index}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.index === clamped ? ACCENT : MUTED}
            strokeWidth={t.index === clamped ? 2 : 1}
          />
        ))}
        <Text x={cx - r - 2} y={cy + 10} style={{ fontSize: 7, fill: MUTED }}>
          E
        </Text>
        <Text x={cx + r - 4} y={cy + 10} style={{ fontSize: 7, fill: MUTED }}>
          F
        </Text>
        {clamped >= 0 ? (
          <G>
            <Line
              x1={cx}
              y1={cy}
              x2={nx}
              y2={ny}
              stroke={ACCENT}
              strokeWidth={2.2}
            />
            <Circle cx={cx} cy={cy} r={3.5} fill={NAVY} />
          </G>
        ) : (
          <Text
            x={cx - 18}
            y={cy - 22}
            style={{ fontSize: 6.5, fill: MUTED }}
          >
            Sin registro
          </Text>
        )}
      </Svg>
    </View>
  );
}
