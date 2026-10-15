import fs from "fs";
import path from "path";

/** Returns the size of the SQLite database file (bytes). */
export function getDbPathSize(): number {
  try {
    // Prisma's SQLite URL looks like: file:/home/.../custom.db
    const url = process.env.DATABASE_URL || "";
    const p = url.startsWith("file:") ? url.slice(5) : url;
    if (!p || !fs.existsSync(p)) return 0;
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

export function getDbPath(): string {
  const url = process.env.DATABASE_URL || "";
  const p = url.startsWith("file:") ? url.slice(5) : url;
  return p || path.join(process.cwd(), "db", "custom.db");
}
