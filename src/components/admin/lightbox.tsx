"use client";

import { useEffect } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

export interface LightboxItem {
  url: string;
  fileName: string;
  isImage: boolean;
}

export default function Lightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length); // RTL: right = next
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  if (index < 0 || index >= items.length) return null;
  const item = items[index];

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-slate-300 truncate max-w-[60%]">{item.fileName}</div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Prev / Next */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % items.length);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white"
            aria-label="التالي"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + items.length) % items.length);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white"
            aria-label="السابق"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Content */}
      <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {item.isImage ? (
          <img
            src={item.url}
            alt={item.fileName}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        ) : (
          <div className="bg-[#161C28] border border-white/10 rounded-xl p-8 text-center">
            <FileIcon />
            <p className="text-sm text-slate-300 mt-3 mb-4">{item.fileName}</p>
            <a
              href={item.url}
              download={item.fileName}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-sm"
            >
              تحميل الملف
            </a>
          </div>
        )}
        <div className="mt-3 text-xs text-slate-500">
          {index + 1} / {items.length}
        </div>
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg className="w-16 h-16 text-slate-500 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
