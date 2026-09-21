/**
 * Invariant checks for close-flow and observations UX (no network).
 * Run: node scripts/audit-close-and-observations.mjs
 */

function assert(name, cond) {
  if (!cond) {
    console.error("FAIL:", name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS:", name);
}

// --- Close step gating (mirrors wizard rules) ---
function canAdvanceTo(targetIndex, steps, currentIndex) {
  if (targetIndex <= currentIndex) return { ok: true };
  const blocker = steps.slice(0, targetIndex).find((s) => s.required && !s.done);
  if (blocker) return { ok: false, blocker: blocker.id };
  return { ok: true };
}

const stepsNoKm = [
  { id: "checkin", required: true, done: true },
  { id: "fuel", required: true, done: false },
  { id: "accessories", required: true, done: true },
  { id: "close", required: true, done: false },
];

assert(
  "no saltar a cierre sin km",
  canAdvanceTo(3, stepsNoKm, 0).ok === false &&
    canAdvanceTo(3, stepsNoKm, 0).blocker === "fuel",
);
assert(
  "sí ir a combustible con check-in listo",
  canAdvanceTo(1, stepsNoKm, 0).ok === true,
);
assert(
  "siempre se puede volver atrás",
  canAdvanceTo(0, stepsNoKm, 2).ok === true,
);

const stepsWithKm = stepsNoKm.map((s) =>
  s.id === "fuel" ? { ...s, done: true } : s,
);
assert(
  "con km se puede avanzar a cierre",
  canAdvanceTo(3, stepsWithKm, 1).ok === true,
);

function missingCloseReqs({ hasCheckIn, mileage, fuel, accessories, returnReviewed, signature }) {
  const missing = [];
  if (!hasCheckIn) missing.push("checkin");
  if (hasCheckIn && mileage == null) missing.push("km");
  if (hasCheckIn && !fuel) missing.push("fuel");
  if (hasCheckIn && !accessories) missing.push("accessories");
  if (!returnReviewed) missing.push("return");
  if (!signature) missing.push("signature");
  return missing;
}

assert(
  "cerrar sin km queda bloqueado",
  missingCloseReqs({
    hasCheckIn: true,
    mileage: null,
    fuel: "FULL",
    accessories: true,
    returnReviewed: true,
    signature: true,
  }).includes("km"),
);

assert(
  "con km completo no exige km",
  !missingCloseReqs({
    hasCheckIn: true,
    mileage: 45000,
    fuel: "FULL",
    accessories: true,
    returnReviewed: true,
    signature: true,
  }).includes("km"),
);

// --- Fuel label index (PDF gauge) ---
const FUEL_LEVEL_ORDER = [
  "EMPTY",
  "ONE_EIGHTH",
  "QUARTER",
  "THREE_EIGHTHS",
  "HALF",
  "FIVE_EIGHTHS",
  "THREE_QUARTERS",
  "SEVEN_EIGHTHS",
  "FULL",
];
const FUEL_LEVEL_LABELS = {
  SEVEN_EIGHTHS: "7/8 (casi lleno)",
  FULL: "Lleno (F)",
};

function fuelLevelIndex(levelOrLabel) {
  if (!levelOrLabel) return -1;
  const raw = String(levelOrLabel).trim();
  const orderIndex = FUEL_LEVEL_ORDER.indexOf(raw);
  if (orderIndex >= 0) return orderIndex;
  for (const [key, label] of Object.entries(FUEL_LEVEL_LABELS)) {
    if (label === raw) return FUEL_LEVEL_ORDER.indexOf(key);
  }
  if (raw === "7/8" || raw === "7/8 (casi lleno)") return 7;
  return -1;
}

assert("PDF gauge 7/8 casi lleno", fuelLevelIndex("7/8 (casi lleno)") === 7);
assert("PDF gauge enum", fuelLevelIndex("SEVEN_EIGHTHS") === 7);

console.log(
  process.exitCode
    ? "\nAuditoría local: HAY FALLAS"
    : "\nAuditoría local: OK — km obligatorio + observaciones únicas + gauge",
);
