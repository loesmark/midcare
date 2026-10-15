import { NextRequest } from "next/server";
import { authenticate } from "@/lib/auth";
import { getSetting, resolveTelegramFile } from "@/lib/telegram";
import { Err } from "@/lib/api";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp", pdf: "application/pdf",
  mp4: "video/mp4", mov: "video/quicktime", mp3: "audio/mpeg",
};

/**
 * GET /api/v1/admin/telegram-file/[fileId]?t=<token>
 *
 * Task 8 support: proxies a Telegram file (by file_id) so the admin dashboard
 * can render patient images as thumbnails + open them in a lightbox. The bot
 * token is read from saved settings (server-side only — never exposed).
 *
 * Auth: the admin JWT is accepted either from the Authorization header OR from
 * a `?t=` query param — the latter is needed because <img> tags cannot set
 * custom headers, and this endpoint is used as an image src.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  // Inject a query-based token into the request headers so `authenticate` can
  // pick it up (it reads the Authorization header).
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("t");
  let authReq = req;
  if (queryToken && !req.headers.get("authorization")) {
    authReq = new NextRequest(req.url, {
      headers: { ...Object.fromEntries(req.headers.entries()), authorization: `Bearer ${queryToken}` },
    });
  }
  const user = await authenticate(authReq);
  if (!user || user.role !== "admin") {
    return Err.unauthorized("Admin access required.");
  }

  const { fileId } = await params;
  if (!fileId || fileId.length < 5) {
    return Err.badRequest("TELEGRAM_FILE_ID_REQUIRED", "A valid file_id is required.");
  }

  const botToken = await getSetting("telegram_bot_token");
  if (!botToken) {
    return Err.badRequest("TELEGRAM_NOT_CONFIGURED", "Telegram bot token is not configured. Set it in Settings first.");
  }

  const resolved = await resolveTelegramFile(botToken, fileId);
  if (!resolved.ok || !resolved.url) {
    return Err.notFound("TELEGRAM_FILE_NOT_FOUND", resolved.error || "Could not resolve the Telegram file.");
  }

  // stream the binary to the client
  const ext = (resolved.filePath || "").split(".").pop()?.toLowerCase() || "bin";
  const mime = MIME[ext] || "application/octet-stream";
  try {
    const upstream = await fetch(resolved.url);
    if (!upstream.ok) {
      return Err.internal("TELEGRAM_DOWNLOAD_FAILED", `Telegram returned ${upstream.status}.`);
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600, immutable",
      },
    });
  } catch (err) {
    return Err.internal("TELEGRAM_DOWNLOAD_FAILED", (err as Error).message);
  }
}
