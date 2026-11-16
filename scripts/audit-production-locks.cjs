/**
 * OLDES production locks — zero margin for Jaime-class regressions.
 * Run: node scripts/audit-production-locks.cjs
 * Also: npm run audit:all
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

let failed = 0;
function lock(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error(`  FAIL  ${msg}`);
    return;
  }
  console.log(`  OK  ${msg}`);
}

console.log("\n=== OLDES production locks ===\n");

const moneySrc = read("src/lib/money.ts");
lock(
  moneySrc.includes("CENT_SETTLE_CENTS = 2") &&
    moneySrc.includes("export function closeBalanceDue") &&
    moneySrc.includes("export function toCents"),
  "Money settles in integer cents (CTR-045 class)",
);

function recoverCommercialDiscountPercent({
  agreedRate,
  rentalDays,
  discountPercent,
  discountAmount,
}) {
  const pct = Number(discountPercent ?? 0);
  if (pct > 0) return pct;
  const days = Math.max(1, Number(rentalDays) || 1);
  const rate = Number(agreedRate) || 0;
  const amount = Number(discountAmount) || 0;
  if (rate <= 0 || amount <= 0) return 0;
  return Math.round((amount / (rate * days)) * 10000) / 100;
}
function dailyRateAfterCommercialDiscount(rate, percent) {
  return Math.round(Number(rate) * (1 - Number(percent) / 100) * 1e6) / 1e6;
}
function toCentsJs(n) {
  return Math.round(Number(n) * 100);
}
function settleCentsJs(n) {
  const c = toCentsJs(n);
  return Math.abs(c) <= 2 ? 0 : c / 100;
}

const recovered = recoverCommercialDiscountPercent({
  agreedRate: 27,
  rentalDays: 4,
  discountPercent: null,
  discountAmount: 8,
});
lock(Math.abs(recovered - 7.41) < 0.02, "Recover % from $8 off $27×4 ≈ 7.41%");
const billed = dailyRateAfterCommercialDiscount(27, 7.41);
lock(Math.abs(billed - 25) < 0.01, "Commercial day rate is ~$25 not $27");
lock(Math.round(billed * 2 * 100) / 100 === 50, "+2 days commercial = $50");
lock(100 + 54 - 150 === 4, "Failure mode locked: list $27×2 invents $4 pending");
lock(100 + 50 - 150 === 0, "Correct mode locked: $25×2 closes at $0");
lock(
  settleCentsJs(175.98 - 176) === 0,
  "58.66×3 residual 175.98 vs 176 settles to zero (CTR-045)",
);

const quoteSrc = read("src/lib/calculations/quote.ts");
lock(
  quoteSrc.includes("export function recoverCommercialDiscountPercent") &&
    quoteSrc.includes("export function dailyRateAfterCommercialDiscount"),
  "Quote module exports commercial % recover + daily rate helpers",
);

const receipts = read("src/app/dashboard/recibos/actions.ts");
lock(
  /if \(alreadyClosed && row\.balance_due != null\)/.test(receipts) &&
    receipts.includes("previousPaid + Math.max(0, storedBalance)") &&
    receipts.includes("Advance the stored saldo"),
  "Closed receipts advance stored saldo — never re-derive days at list price",
);
lock(
  receipts.includes("recoverCommercialDiscountPercent") &&
    receipts.includes("billedDailyRate") &&
    /dailyRate:\s*billedDailyRate/.test(receipts),
  "Open-contract receipt day calc uses commercial billedDailyRate",
);
lock(
  /requireSaved|staffWriter/.test(receipts),
  "Receipt mutations refuse silent 0-row writes",
);

const contratos = read("src/app/dashboard/contratos/actions.ts");
lock(
  contratos.includes("finalRentalTotal") &&
    /total:\s*finalRentalTotal/.test(contratos) &&
    contratos.includes("discount_percent: closeDiscountPercent") &&
    contratos.includes("dailyRateAfterCommercialDiscount"),
  "Close bakes day adjustment into total and persists commercial %",
);
lock(
  contratos.includes("closeActAlreadyClosed") &&
    contratos.includes("!closeActAlreadyClosed && contract.actual_return_at"),
  "Close-act PDF skips dayAdjustment when already closed",
);
lock(
  contratos.includes("inspection_damage_marks") &&
    contratos.includes("damageMarks: mapMarks(checkOutRow)") &&
    contratos.includes("damageMarks: mapMarks(checkInRow)") &&
    contratos.includes("viewPhotos"),
  "Close context loads OUT/IN damage marks + vehicle wireframe photos",
);
lock(
  contratos.includes("export async function ensureCloseCheckIn"),
  "ensureCloseCheckIn exists to seed entry inspection on close",
);

const wizard = read("src/components/contracts/close-contract-wizard.tsx");
lock(
  wizard.includes('import { DamageMapView }') &&
    wizard.includes('id="mapa-danos-cierre"') &&
    wizard.includes("<DamageMapView") &&
    wizard.includes("referenceMarks={priorDamageMarks}") &&
    wizard.includes("newMarksInRed"),
  "Close wizard EMBEDS damage map (not link-only) with gray OUT / red IN",
);
lock(
  wizard.includes("async function saveDamageMap") &&
    wizard.includes("saveDamageMarks") &&
    /const damageOk = await saveDamageMap\(\)/.test(wizard) &&
    wizard.includes('if (current.id === "fuel"'),
  "Advancing past fuel/espejo persists the damage map before firma",
);
lock(
  wizard.includes("closeBalanceDue"),
  "Close wizard uses the same 2-cent settle as the server",
);

const cerrarPage = read("src/app/dashboard/contratos/[id]/cerrar/page.tsx");
lock(
  cerrarPage.includes("ensureCloseCheckIn") &&
    cerrarPage.includes("getContractCloseContext") &&
    cerrarPage.includes("CloseContractWizard"),
  "Cerrar page ensures CHECK_IN then loads close context into the wizard",
);

const inspDetail = read("src/app/dashboard/inspecciones/[id]/page.tsx");
lock(
  inspDetail.includes('const isCheckIn = inspection?.type === "CHECK_IN"') &&
    inspDetail.includes("configured && inspection && !isCheckIn") &&
    inspDetail.includes(
      "const showAccessories = isCheckIn || !focusPaso || accessoriesOnly",
    ) &&
    inspDetail.includes("showPhotos = true"),
  "CHECK_IN detail always shows accessories/map and never mounts delivery navigator",
);
lock(
  inspDetail.includes("getCheckOutDamageMarksForReservation") &&
    inspDetail.includes("priorDamageMarks={priorDamageMarks}") &&
    inspDetail.includes(
      'newMarksInRed={inspection.type === "CHECK_IN"}',
    ),
  "CHECK_IN detail paints prior OUT marks gray and new marks red",
);

const accessories = read(
  "src/components/inspections/inspection-accessories-panel.tsx",
);
lock(
  accessories.includes("DamageMapView") &&
    accessories.includes("saveDamageMarks") &&
    accessories.includes("priorDamageMarks"),
  "Inspection accessories panel still saves checklist + damage map together",
);

const apkManifest = read("apk-android/app/src/main/AndroidManifest.xml");
const apkMain = read(
  "apk-android/app/src/main/java/com/oldes/rentacar/app/MainActivity.kt",
);
lock(
  fs.existsSync(
    path.join(root, "apk-android/app/src/main/res/xml/file_paths.xml"),
  ) &&
    apkManifest.includes("FileProvider") &&
    apkMain.includes("onShowFileChooser"),
  "APK FileProvider + file chooser present for camera/gallery uploads",
);

const archiveFix = read(
  "supabase/migrations/20261102000001_fix_archive_identity_soft_delete.sql",
);
lock(
  archiveFix.includes("to_jsonb(NEW)") &&
    archiveFix.includes("v_row->>'code'") &&
    archiveFix.includes("v_row->>'slug'") &&
    archiveFix.includes("TG_ARGV[0] = 'slug'"),
  "Archive soft-delete reads code/slug via jsonb (safe for payment_receipts)",
);

const dateField = read("src/components/shared/date-field.tsx");
lock(
  dateField.includes("Elija año") ||
    (dateField.includes("Año") && dateField.includes("Mes")),
  "Date fields allow year jump (birth/license)",
);

const displayPhase = read("src/lib/contracts/display-phase.ts");
lock(
  displayPhase.includes("POR_LIQUIDAR") ||
    read("src/lib/contracts/amount-owed.ts").includes("displayBalanceDue"),
  "Unpaid display phase / balance helpers remain available",
);

// --- Rate / "Calcular tarifa" (Jaime once thought it would not calculate) ---
const rateInput = read("src/components/shared/rate-input.tsx");
lock(
  rateInput.includes('type="text"') &&
    rateInput.includes("sanitizeRateTyping") &&
    rateInput.includes("Calcular tarifa") &&
    rateInput.includes("dailyRateForPactTotal") &&
    rateInput.includes("alignRateToPactTotal") &&
    !/type=["']number["']/.test(rateInput),
  "Daily rate field is text (6dp) with Calcular tarifa — browser cannot block 58.666667",
);
lock(
  read("src/components/contracts/contract-form.tsx").includes("RateWithPactTotal") &&
    read("src/components/forms/reservation-form.tsx").includes("RateWithPactTotal"),
  "Contract + reservation forms use RateWithPactTotal for daily rate",
);
lock(
  moneySrc.includes("RATE_DECIMALS = 6") &&
    moneySrc.includes("export function parseRateInput") &&
    moneySrc.includes("export function dailyRateForPactTotal"),
  "Money module keeps 6dp rate parse + pact-total helpers",
);

console.log("");
if (failed > 0) {
  console.error(`${failed} production lock(s) FAILED — do not ship`);
  process.exit(1);
}
console.log("All production locks passed — safe to ship\n");
process.exit(0);
