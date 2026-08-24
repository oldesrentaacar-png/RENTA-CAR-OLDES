import sharp from "sharp";

import {
  PANEL_DAMAGE_LEGEND,
  buildCarDiagramSvg,
  resolveBodyStyle,
  type VehicleBodyStyle,
} from "@/lib/inspections/vehicle-panel-map";

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la foto del vehículo (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderPanelPng(
  bodyStyle: VehicleBodyStyle,
  showLegend = false,
): Promise<Buffer> {
  const svg = buildCarDiagramSvg(bodyStyle, {
    width: 680,
    height: 1120,
    showLegend,
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Hoja exacta estilo formulario físico:
 * foto + sedán (tapa baúl) + pickup (palangana) + leyenda O/+/x
 */
async function renderInspectionSheet(input: {
  photo: Buffer;
  vehicleLabel: string;
  bodyStyle: VehicleBodyStyle;
}): Promise<Buffer> {
  const sedan = await renderPanelPng("SEDAN", true);
  const pickup = await renderPanelPng("PICKUP", false);
  const photoPlate = await sharp(input.photo)
    .rotate()
    .resize(380, 260, { fit: "contain", background: "#f3e6c0" })
    .png()
    .toBuffer();

  const cellW = 340;
  const cellH = 560;
  const pad = 20;
  const header = 88;
  const photoBlock = 280;
  const width = pad * 3 + cellW * 2;
  const height = header + photoBlock + pad + cellH + pad;

  const sedanCell = await sharp(sedan)
    .resize(cellW, cellH, { fit: "contain", background: "#f3e6c0" })
    .png()
    .toBuffer();
  const pickupCell = await sharp(pickup)
    .resize(cellW, cellH, { fit: "contain", background: "#f3e6c0" })
    .png()
    .toBuffer();

  const legend = PANEL_DAMAGE_LEGEND.map(
    (item) => `${item.symbol} = ${item.meaning}`,
  ).join("   ");

  const headerSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${header}">
  <rect width="100%" height="100%" fill="#1e4d8c"/>
  <text x="24" y="34" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#ffffff" font-weight="700">PLANO DE INSPECCIÓN · ESTADO DEL VEHÍCULO</text>
  <text x="24" y="58" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#bfdbfe">${escapeXml(input.vehicleLabel)}</text>
  <text x="24" y="78" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#fde68a" font-weight="700">CÓDIGO: ${escapeXml(legend)}</text>
</svg>`;

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#f3e6c0",
    },
  })
    .composite([
      { input: Buffer.from(headerSvg), left: 0, top: 0 },
      {
        input: photoPlate,
        left: Math.round((width - 380) / 2),
        top: header + 10,
      },
      { input: sedanCell, left: pad, top: header + photoBlock },
      { input: pickupCell, left: pad * 2 + cellW, top: header + photoBlock },
    ])
    .png()
    .toBuffer();
}

export type GeneratedVehicleAssets = {
  inspectionSheet: Buffer;
  topPanel: Buffer;
  bodyStyle: VehicleBodyStyle;
};

/** Genera el plano tipo formulario físico (silueta de carro real). */
export async function generateVehicleAssetsFromPhoto(input: {
  sourceImageUrl: string;
  vehicleLabel: string;
  category?: string | null;
  model?: string | null;
}): Promise<GeneratedVehicleAssets> {
  const photo = await fetchImageBuffer(input.sourceImageUrl);
  const normalized = await sharp(photo)
    .rotate()
    .resize(1200, 900, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const bodyStyle = resolveBodyStyle(input.category, input.model);
  const topPanel = await renderPanelPng(bodyStyle, true);
  const inspectionSheet = await renderInspectionSheet({
    photo: normalized,
    vehicleLabel: input.vehicleLabel,
    bodyStyle,
  });

  return { inspectionSheet, topPanel, bodyStyle };
}
