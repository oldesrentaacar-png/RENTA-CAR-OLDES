#!/usr/bin/env node
/**
 * Smoke test for Rent A Car Pro public API.
 * Usage: npm run smoke:api  (requires dev server on BASE_URL)
 */

const BASE_URL = (process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const ORIGIN = process.env.LANDING_ALLOWED_ORIGIN?.split(",")[0]?.trim() || "http://localhost:3000";

function log(label, message) {
  console.log(`[${label}] ${message}`);
}

function logJson(label, obj) {
  console.log(`[${label}]`, JSON.stringify(obj, null, 2));
}

async function fetchJson(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, ok: res.ok };
}

function sampleRequestPayload(overrides = {}) {
  const today = new Date();
  const pickup = new Date(today);
  pickup.setDate(pickup.getDate() + 14);
  const ret = new Date(pickup);
  ret.setDate(ret.getDate() + 3);

  const fmt = (d) => d.toISOString().slice(0, 10);

  return {
    firstName: "Smoke",
    lastName: "Test",
    phone: "50370000001",
    email: "smoke-test@example.com",
    pickupDate: fmt(pickup),
    pickupTime: "09:00",
    returnDate: fmt(ret),
    returnTime: "18:00",
    vehicleCategory: "SEDAN",
    notes: "Smoke test — safe to delete",
    website: "",
    ...overrides,
  };
}

async function testGetVehicles() {
  log("GET /api/public/vehicles", "Requesting...");
  const { status, body, ok } = await fetchJson("/api/public/vehicles");

  if (status === 503) {
    log("GET /api/public/vehicles", "SKIP — Supabase admin not configured (503)");
    return { skipped: true };
  }

  log("GET /api/public/vehicles", `Status: ${status}`);
  if (body) {
    if (body.success && Array.isArray(body.data)) {
      log("GET /api/public/vehicles", `OK — ${body.data.length} vehicle(s)`);
      if (body.data[0]) {
        logJson("GET sample", {
          id: body.data[0].id,
          slug: body.data[0].slug,
          brand: body.data[0].brand,
          dailyRate: body.data[0].dailyRate,
        });
      }
    } else {
      logJson("GET /api/public/vehicles", body);
    }
  }

  return { ok, status, body };
}

async function testPostRequest(label, payload, headers) {
  log(label, "Requesting...");
  const { status, body, ok } = await fetchJson("/api/public/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  log(label, `Status: ${status}`);
  if (body) logJson(label, body);

  if (status === 403 && body?.error?.code === "FORBIDDEN") {
    log(label, "Hint: set LANDING_ALLOWED_ORIGIN to include Origin header value");
  }
  if (status === 503) {
    log(label, "SKIP — Supabase admin not configured");
  }

  return { ok, status, body };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Rent A Car Pro — Public API Smoke Test");
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`ORIGIN:   ${ORIGIN}`);
  console.log("=".repeat(60));

  try {
    await testGetVehicles();
    console.log("");

    await testPostRequest(
      "POST /api/public/requests (valid + empty honeypot)",
      sampleRequestPayload(),
    );
    console.log("");

    await testPostRequest(
      "POST /api/public/requests (honeypot triggered)",
      sampleRequestPayload({ website: "bot-filled-this" }),
    );
  } catch (err) {
    const cause = err instanceof Error ? err : new Error(String(err));
    if (
      cause.message.includes("ECONNREFUSED") ||
      cause.message.includes("fetch failed") ||
      cause.cause?.code === "ECONNREFUSED"
    ) {
      log("SKIP", `Cannot connect to ${BASE_URL} — is "npm run dev" running?`);
      console.log("\nSmoke test skipped (connection error). Exit 0.");
      process.exit(0);
    }
    console.error("[ERROR]", cause.message);
    process.exit(1);
  }

  console.log("\nSmoke test finished.");
}

main();
