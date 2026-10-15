import { NextResponse } from "next/server";

/** Standard success envelope. */
export function ok(data: unknown, message = "OK") {
  return NextResponse.json({ success: true, data, message });
}

export function created(data: unknown, message = "Created") {
  return NextResponse.json({ success: true, data, message }, { status: 201 });
}

export function paginate(rows: unknown[], total: number, page: number, limit: number, message = "OK") {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return NextResponse.json({
    success: true,
    data: rows,
    message,
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  });
}

/** Build a standard error Response. */
export function apiError(code: string, message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, error: { code, message, ...extra } },
    { status }
  );
}

export const Err = {
  badRequest: (code: string, message: string, extra?: Record<string, unknown>) => apiError(code, message, 400, extra),
  unauthorized: (message = "Authentication required.") => apiError("AUTH_REQUIRED", message, 401),
  /** `forbidden(message?)` — accepts an optional message. Many routes call
   *  `Err.forbidden("AUTH_FORBIDDEN")` passing the code as the first arg;
   *  we keep that back-compat by treating the first arg as the message
   *  (defaults to "Forbidden."). */
  forbidden: (message = "Forbidden.") => apiError("AUTH_FORBIDDEN", message, 403),
  notFound: (code: string, message: string) => apiError(code, message, 404),
  conflict: (code: string, message: string) => apiError(code, message, 409),
  internal: (code: string, message: string) => apiError(code, message, 500),
};

/** Read pagination query params with safe defaults. */
export function pagination(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
