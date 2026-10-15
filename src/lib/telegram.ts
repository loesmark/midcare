import { db } from "./db";

/** In-memory cache of settings (refreshed on writes). */
let settingsCache: Record<string, string> | null = null;

/** Load all settings as a key→value map (cached). */
export async function getSettings(): Promise<Record<string, string>> {
  if (settingsCache) return settingsCache;
  const rows = await db.setting.findMany();
  settingsCache = Object.fromEntries(rows.map((r) => [r.key, r.value || ""]));
  return settingsCache;
}

/** Get a single setting value. */
export async function getSetting(key: string): Promise<string> {
  const s = await getSettings();
  return s[key] || "";
}

/** Update settings (merges), then invalidates the cache. */
export async function updateSettings(patch: Record<string, string>) {
  for (const [key, value] of Object.entries(patch)) {
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
  settingsCache = null; // invalidate
  return getSettings();
}

export interface TelegramConfig {
  botToken: string;
  chatId: string; // image / file storage group
  alertsChatId: string; // alerts group (Task 6)
  doctorWhatsapp: string;
}

/** Read the telegram-related settings. */
export async function getTelegramConfig(): Promise<TelegramConfig> {
  const s = await getSettings();
  return {
    botToken: s.telegram_bot_token || "",
    chatId: s.telegram_chat_id || "",
    alertsChatId: s.telegram_alerts_chat_id || "",
    doctorWhatsapp: s.doctor_whatsapp || "",
  };
}

/** Send a text message to a Telegram chat via the bot. */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  if (!botToken || !chatId) {
    return { ok: false, error: "Bot token or chat id not configured" };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description || "Telegram API error" };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Upload a file (Buffer) to a Telegram chat as a photo/document. Returns the file_id. */
export async function uploadFileToTelegram(
  botToken: string,
  chatId: string,
  fileBuffer: Buffer,
  fileName: string,
  caption?: string
): Promise<{ ok: boolean; error?: string; fileId?: string }> {
  if (!botToken || !chatId) {
    return { ok: false, error: "Bot token or chat id not configured" };
  }
  try {
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
    const endpoint = isImage ? "sendPhoto" : "sendDocument";
    const field = isImage ? "photo" : "document";

    const form = new FormData();
    form.append("chat_id", chatId);
    // Convert Node Buffer → Uint8Array view (avoids the SharedArrayBuffer
    // type-narrowing issue between Node's Buffer and the DOM Blob definition).
    const blob = new Blob([new Uint8Array(fileBuffer)]);
    form.append(field, blob, fileName);
    if (caption) form.append("caption", caption);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description || "Telegram API error" };
    }
    const result = data.result;
    const fileId = isImage ? result?.photo?.[result.photo.length - 1]?.file_id : result?.document?.file_id;
    return { ok: true, fileId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Resolve a Telegram file_id to a download URL (requires bot token). */
export async function resolveTelegramFile(
  botToken: string,
  fileId: string
): Promise<{ ok: boolean; error?: string; url?: string; filePath?: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    const data = await res.json();
    if (!data.ok || !data.result?.file_path) {
      return { ok: false, error: data.description || "Could not resolve file" };
    }
    const filePath = data.result.file_path;
    const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    return { ok: true, url, filePath };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
