import { NextResponse } from "next/server";

/**
 * GET /health
 *
 * Lightweight health probe used by the Flutter app's `isBackendReachable()`
 * to check connectivity before attempting authenticated requests. Returns
 * 200 + a tiny JSON body — no DB calls, no auth.
 */
export async function GET() {
  return NextResponse.json(
    { success: true, data: { status: "ok" }, message: "MediCare backend is running." },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
