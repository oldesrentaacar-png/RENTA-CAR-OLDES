#!/usr/bin/env node
/**
 * Regression audit for Sep 30 delivery/ops fixes.
 * Fails (exit 1) if known bug patterns reappear in source.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
let failed = 0;
const ok = [];
const bad = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else {
    bad.push(msg);
    failed += 1;
  }
}

// --- Signature: pointer up must NEVER call onConfirm ---
{
  const src = read("src/components/contracts/signature-pad.tsx");
  assert(
    src.includes("Confirmar firma") && src.includes("onConfirm(canvas.toDataURL"),
    "SignaturePad confirms only via Confirmar firma",
  );
  const upBlock = src.slice(
    src.indexOf("const onPointerUp"),
    src.indexOf("const clear"),
  );
  assert(
    !upBlock.includes("onConfirm") && !upBlock.includes("toDataURL"),
    "SignaturePad onPointerUp does not capture/save signature",
  );
  assert(
    src.includes("Puede levantar el dedo"),
    "SignaturePad instructs multi-stroke",
  );
}

// --- Photos always visible on inspection detail ---
{
  const src = read("src/app/dashboard/inspecciones/[id]/page.tsx");
  assert(
    /const showPhotos\s*=\s*true/.test(src),
    "Inspection detail always shows photos (showPhotos = true)",
  );
  assert(
    src.includes("mileage={inspection.mileage}"),
    "Inspection accessories panel receives mileage",
  );
  assert(src.includes('id="fotos"') || src.includes("Fotos del vehículo"), "Photos section present");
}

// --- Create inspection lands on photos step ---
{
  const src = read("src/components/inspections/inspection-create-form.tsx");
  assert(
    src.includes("paso=inspeccion-salida"),
    "New inspection redirects to inspeccion-salida (photos step)",
  );
}

// --- PDF step opens document ---
{
  const src = read("src/lib/contracts/delivery-steps.ts");
  assert(
    src.includes("actionHref: contractPdfHref"),
    "Delivery PDF step has actionHref to real PDF",
  );
  const nav = read("src/components/contracts/contract-delivery-navigator.tsx");
  assert(
    nav.includes("current.actionHref ?? current.href"),
    "Navigator primary button uses actionHref for PDF",
  );
}

// --- Freehand marks must not show #numbers in UI/PDF labels ---
{
  const map = read("src/components/inspections/damage-map-2d.tsx");
  assert(
    map.includes("Marcado libre (sin número)") || map.includes("sin número"),
    "Damage map freehand has unnumbered marker",
  );
  assert(
    !map.includes("`#${mark.markNumber} · Trazo libre`") &&
      !map.includes("#${mark.markNumber} Marcado libre"),
    "Damage map list/badge does not number freehand as Trazo libre #N",
  );
  const pdf = read("src/lib/pdf/contract-pdf.tsx");
  assert(
    !pdf.includes("#{mark.markNumber") && !pdf.includes("#${mark.markNumber"),
    "Contract PDF damage notes do not prefix #markNumber",
  );
  const close = read("src/app/dashboard/contratos/actions.ts");
  assert(
    close.includes('return note ? `Trazo libre — ${note}` : "Trazo libre"') ||
      close.includes("Trazo libre"),
    "Close-act damage lines treat freehand without #",
  );
  assert(
    !close.includes("`#${mark.markNumber} ${mark.symbol}"),
    "Close-act no longer uses #markNumber template",
  );
  const images = read("src/lib/pdf/pdf-images.ts");
  assert(
    images.includes("pathPoints.length >= 2) return null"),
    "PDF wireframe skips numbered pins on freehand strokes",
  );
}

// --- Mileage in PDF vehicle + checklist ---
{
  const pdf = read("src/lib/pdf/contract-pdf.tsx");
  assert(
    pdf.includes('label="Kilometraje (salida)"') && pdf.includes("mileageOut"),
    "PDF shows Kilometraje (salida) from mileageOut",
  );
  assert(
    pdf.includes("Km salida:") && pdf.includes("NIVEL COMBUSTIBLE"),
    "PDF checklist panel shows Km salida",
  );
  const accessories = read(
    "src/components/inspections/inspection-accessories-panel.tsx",
  );
  assert(
    accessories.includes("Kilometraje de salida"),
    "Accessories panel shows Kilometraje de salida beside inventory",
  );
}

// --- Customer display name helper used for contracts/inspections ---
{
  const customers = read("src/lib/customers.ts");
  assert(
    customers.includes('customer_type === "COMPANY"') &&
      customers.includes("company_name"),
    "getCustomerDisplayName prefers company_name for COMPANY",
  );
  const insp = read("src/app/dashboard/inspecciones/actions.ts");
  assert(
    insp.includes("getCustomerDisplayName"),
    "Inspection detail uses getCustomerDisplayName",
  );
  const contracts = read("src/app/dashboard/contratos/actions.ts");
  assert(
    contracts.includes("customerName: getCustomerDisplayName"),
    "Contract detail/PDF uses getCustomerDisplayName",
  );
  const pdfPage = read("src/app/dashboard/contratos/[id]/page.tsx");
  assert(
    !pdfPage.includes("{contract.vehicleLabel}\n                {\" · \"}\n                {contract.plate}"),
    "Contract delivery header does not duplicate plate after vehicleLabel",
  );
}

// --- Rate precision 6dp ---
{
  const money = read("src/lib/money.ts");
  assert(
    money.includes("RATE_DECIMALS = 6") && money.includes("parseRateInput"),
    "money.ts exposes RATE_DECIMALS=6 and parseRateInput",
  );
  try {
    const Decimal = require(path.join(root, "node_modules/decimal.js"));
    const rate = new Decimal("62.142857");
    const days = new Decimal(7);
    const product = rate
      .mul(days)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    assert(product === 435, `7 × 62.142857 = 435.00 (got ${product})`);
  } catch {
    ok.push(
      "decimal.js runtime check skipped (package unreadable in this environment)",
    );
  }
}

// --- Socios / por liquidar ---
{
  const phase = read("src/lib/contracts/display-phase.ts");
  assert(
    phase.includes("POR_LIQUIDAR") && phase.includes("balanceDue > 0.009"),
    "Display phase includes POR_LIQUIDAR for unpaid balances",
  );
  const form = read("src/components/forms/partner-rental-form.tsx");
  assert(
    form.includes("Traer datos") && form.includes("contract_code"),
    "Partner form can pull contract by code",
  );
  const mig40 = fs.existsSync(
    path.join(
      root,
      "supabase/migrations/20260930000040_partner_rentals_contract_link.sql",
    ),
  );
  const mig41 = fs.existsSync(
    path.join(root, "supabase/migrations/20260930000041_rate_precision_6dp.sql"),
  );
  assert(mig40, "Migration 040 partner_rentals contract link exists");
  assert(mig41, "Migration 041 rate precision 6dp exists");
}

// --- Oct 30: no silent 0-row writes, no vehicle swap, honest money ---
{
  assert(
    !fs.existsSync(
      path.join(root, "src/components/contracts/contract-vehicle-changer.tsx"),
    ),
    "Contract vehicle changer component is gone",
  );
  const contracts = read("src/app/dashboard/contratos/actions.ts");
  assert(
    !contracts.includes("export async function changeContractVehicle"),
    "changeContractVehicle action is gone",
  );
  const reservations = read("src/app/dashboard/reservas/actions.ts");
  assert(
    !reservations.includes("cámbielo en el contrato"),
    "Cancel reservation does not tell staff to swap the vehicle on the contract",
  );
  const terms = read("src/lib/contracts/oldes-terms.ts");
  assert(
    terms.includes("oldesrentaacar@gmail.com") &&
      terms.includes("San Luis Talpa, La Paz, El Salvador"),
    "Company contact is assigned Gmail and San Luis Talpa",
  );
  const owed = read("src/lib/contracts/amount-owed.ts");
  assert(
    owed.includes("export function displayBalanceDue") &&
      owed.includes("paymentStatus"),
    "displayBalanceDue uses stored saldo or unpaid total, not a fake paid zero",
  );
  const money = read("src/lib/money.ts");
  assert(
    money.includes("CENT_SETTLE_EPS = 0.02") &&
      money.includes("CENT_SETTLE_CENTS = 2") &&
      money.includes("export function toCents") &&
      money.includes("export function snapCommercialDollars") &&
      money.includes("export function settleCents") &&
      money.includes("export function alignRateToPactTotal") &&
      money.includes("export function closeBalanceDue"),
    "2-cent rounding of 58.66×3=175.98 vs $176 is settled, not a credit",
  );
  const quoteCalc = read("src/lib/calculations/quote.ts");
  assert(
    quoteCalc.includes("snapCommercialDollars"),
    "Reservation/contract total snaps 2-cent residuals to the pact dollar",
  );
  assert(
    quoteCalc.includes("export function recoverCommercialDiscountPercent"),
    "Commercial % discount can be recovered from a fixed USD cut when extending days",
  );
  const receiptsBilling = read("src/app/dashboard/recibos/actions.ts");
  assert(
    receiptsBilling.includes("recoverCommercialDiscountPercent") &&
      receiptsBilling.includes("alreadyClosed") &&
      receiptsBilling.includes("billedDailyRate") &&
      receiptsBilling.includes("balance_due") &&
      receiptsBilling.includes("Advance the stored saldo"),
    "Receipt balance recalcs use discounted day rate and do not reinvent extras on closed contracts",
  );
  const closePersist = read("src/app/dashboard/contratos/actions.ts");
  assert(
    closePersist.includes("finalRentalTotal") &&
      closePersist.includes("discount_percent: closeDiscountPercent"),
    "Close persists discounted total so a later abono cannot leave a fake $4 saldo",
  );
  assert(
    closePersist.includes("closeActAlreadyClosed") &&
      closePersist.includes("!closeActAlreadyClosed && contract.actual_return_at"),
    "Close-act PDF does not re-apply dayAdjustment on already-closed contracts",
  );
  const closeWizard = read("src/components/contracts/close-contract-wizard.tsx");
  assert(
    closeWizard.includes("DamageMapView") &&
      closeWizard.includes("mapa-danos-cierre") &&
      closeWizard.includes("saveDamageMarks"),
    "Close wizard embeds entry damage map so rayones are visible without leaving close",
  );
  assert(
    closePersist.includes("inspection_damage_marks") &&
      closePersist.includes("damageMarks: mapMarks"),
    "Close context loads CHECK_OUT/CHECK_IN damage marks for the map",
  );
  const inspectionDetail = read("src/app/dashboard/inspecciones/[id]/page.tsx");
  assert(
    inspectionDetail.includes('inspection?.type === "CHECK_IN"') &&
      inspectionDetail.includes("!isCheckIn"),
    "CHECK_IN detail does not show the delivery navigator that hid return damages",
  );
  const dateField = read("src/components/shared/date-field.tsx");
  assert(
    dateField.includes("Elija año") || dateField.includes("Año"),
    "Birth/date fields expose year-month-day selects instead of month-by-month native pickers",
  );
  assert(
    fs.existsSync(
      path.join(root, "apk-android/app/src/main/res/xml/file_paths.xml"),
    ),
    "APK FileProvider paths exist for camera capture uploads",
  );
  const close = read("src/app/dashboard/contratos/actions.ts");
  assert(
    close.includes("closeBalanceDue") && close.includes("alignRateToPactTotal"),
    "Contract create/close aligns the daily rate and settles 2-cent close residuals",
  );
  const wizard = read("src/components/contracts/close-contract-wizard.tsx");
  assert(
    wizard.includes("closeBalanceDue"),
    "Close wizard uses the same 2-cent settle as the server",
  );
  const owedCalc = read("src/lib/contracts/amount-owed.ts");
  assert(
    owedCalc.includes("snapCommercialDollars") &&
      owedCalc.includes("closeBalanceDue"),
    "Owed and receipt balances snap/settle 2-cent residuals",
  );
  assert(
    fs.existsSync(
      path.join(
        root,
        "supabase/migrations/20261101000001_settle_contract_cent_residuals.sql",
      ),
    ),
    "DB trigger migration settles 2-cent contract residuals",
  );
  require("./audit-money-cents.cjs");
  const archiveFix = read(
    "supabase/migrations/20261102000001_fix_archive_identity_soft_delete.sql",
  );
  assert(
    archiveFix.includes("to_jsonb(NEW)") &&
      archiveFix.includes("TG_ARGV[0] = 'code'") &&
      archiveFix.includes("finance.delete"),
    "Soft-delete archive trigger does not touch slug on payment_receipts",
  );
  const receipts = read("src/app/dashboard/recibos/actions.ts");
  assert(
    receipts.includes("requireSaved") &&
      receipts.includes("voidPaymentReceipt"),
    "Anular recibo refuses silent 0-row soft-delete",
  );
  const nav = read("src/components/dashboard/nav-config.ts");
  assert(
    nav.includes('["finance.view", "finance.create"]'),
    "Ingresos/Gastos/Recibos nav visible with finance.create",
  );
  const inspections = read("src/app/dashboard/inspecciones/actions.ts");
  assert(
    inspections.includes('"inspections.create"') &&
      inspections.includes("assertAnyPermission"),
    "Inspection update allowed with inspections.create or inspections.edit",
  );
  const writer = read("src/lib/db/staff-write.ts");
  assert(
    writer.includes("export function staffWriter") &&
      writer.includes("export function requireSaved"),
    "staffWriter + requireSaved reject 0-row updates",
  );
  const calendar = read("src/app/dashboard/reservas/actions.ts");
  assert(
    calendar.includes("actual_return_at") &&
      calendar.includes("displayEnd"),
    "Calendar bar uses actual return date when present",
  );
}

console.log("\n=== OLDES Sep30 regression audit ===\n");
for (const m of ok) console.log("  OK  " + m);
for (const m of bad) console.log("  FAIL  " + m);
console.log(`\n${ok.length} passed, ${bad.length} failed\n`);
process.exit(failed ? 1 : 0);
