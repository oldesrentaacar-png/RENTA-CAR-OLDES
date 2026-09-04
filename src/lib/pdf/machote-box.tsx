import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";

import { PDF_BRAND } from "@/lib/pdf/brand-assets";

const LINE = PDF_BRAND.border;
const NAVY = PDF_BRAND.navy;
const MUTED = PDF_BRAND.muted;

export const machoteStyles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 5,
  },
  sectionTitle: {
    backgroundColor: NAVY,
    color: "#ffffff",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 5,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 3,
    gap: 3,
  },
  cell: {
    width: "48%",
    borderWidth: 0.8,
    borderColor: LINE,
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    minHeight: 22,
  },
  cellFull: {
    width: "100%",
  },
  cellHalf: {
    width: "48%",
  },
  cellThird: {
    width: "31%",
  },
  cellLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  cellValue: {
    fontSize: 8.5,
    color: "#0f172a",
    lineHeight: 1.25,
  },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
  },
  billingTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: "#f1f5f9",
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
});

export function MachoteSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={machoteStyles.section}>
      <Text style={machoteStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function MachoteField({
  label,
  value,
  width = "half",
}: {
  label: string;
  value?: string | null;
  width?: "full" | "half" | "third";
}) {
  const text = value?.trim();
  if (!text) return null;

  const widthStyle =
    width === "full"
      ? machoteStyles.cellFull
      : width === "third"
        ? machoteStyles.cellThird
        : machoteStyles.cellHalf;

  return (
    <View style={[machoteStyles.cell, widthStyle]}>
      <Text style={machoteStyles.cellLabel}>{label}</Text>
      <Text style={machoteStyles.cellValue}>{text}</Text>
    </View>
  );
}

export function MachoteGrid({ children }: { children: React.ReactNode }) {
  return <View style={machoteStyles.grid}>{children}</View>;
}
