"use client";

import type { ConnectionBanner } from "../types";

interface ConnectionBannerProps {
  banner: ConnectionBanner;
}

export function ConnectionBannerBar({ banner }: ConnectionBannerProps) {
  if (!banner) {
    return null;
  }

  if (banner.kind === "disconnected") {
    return (
      <div className="border-b border-red-500/40 bg-red-500/15 px-4 py-2 text-center text-sm text-red-200">
        ⚠️ Disconnected — Reconnecting… (attempt {banner.attempt}/{banner.maxAttempts})
      </div>
    );
  }

  return (
    <div className="border-b border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-center text-sm text-emerald-200">
      ✅ Reconnected — No messages lost (resumed from seq #{banner.resumeSeq})
    </div>
  );
}
