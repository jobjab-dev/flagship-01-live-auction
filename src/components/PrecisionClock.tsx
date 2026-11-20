"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, ShieldAlert } from "lucide-react";

interface PrecisionClockProps {
  endsAt: number;
  lastExtendedAt: number | null;
  onExpire?: () => void;
}

function formatMsCountdown(remainingMs: number): {
  mm: string;
  ss: string;
  mmm: string;
} {
  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor(clamped % 1000);

  return {
    mm: String(minutes).padStart(2, "0"),
    ss: String(seconds).padStart(2, "0"),
    mmm: String(ms).padStart(3, "0"),
  };
}

export function PrecisionClock({
  endsAt,
  durationFallbackMs = 42_000,
  lastExtendedAt,
  onExpire,
}: PrecisionClockProps & { durationFallbackMs?: number }) {
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState<number>(durationFallbackMs);
  const [showExtensionFlash, setShowExtensionFlash] = useState(false);

  useEffect(() => {
    setMounted(true);
    let rafId = 0;
    let notified = false;

    const tick = () => {
      if (endsAt <= 0) {
        setRemaining(durationFallbackMs);
        return;
      }
      const next = Math.max(0, endsAt - Date.now());
      setRemaining(next);
      if (next <= 0) {
        if (!notified) {
          notified = true;
          onExpire?.();
        }
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [endsAt, durationFallbackMs, onExpire]);

  useEffect(() => {
    if (!lastExtendedAt) return;
    setShowExtensionFlash(true);
    const timer = setTimeout(() => setShowExtensionFlash(false), 2600);
    return () => clearTimeout(timer);
  }, [lastExtendedAt]);

  const isClosed = mounted && endsAt > 0 && remaining <= 0;
  const isUrgent = mounted && remaining > 0 && remaining <= 10_000;
  const { mm, ss, mmm } = formatMsCountdown(remaining);

  return (
    <div
      className={`border px-4 py-3 transition-colors duration-200 ${
        isClosed
          ? "border-[#305849] bg-[#0B271D]"
          : isUrgent
            ? "border-[#D6331F] bg-[#36110D]"
            : "border-[#285443] bg-[#0D2E22]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-mono uppercase tracking-[0.12em]">
        <span
          className={`inline-flex items-center gap-1.5 ${
            isUrgent ? "text-[#FF9E92]" : "text-[#B6D0C4]"
          }`}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {isClosed
            ? "Hammer Closed"
            : isUrgent
              ? "Final 10s · Anti-Snipe Active"
              : "Saleroom Closing Clock"}
        </span>

        <AnimatePresence>
          {showExtensionFlash && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="inline-flex items-center gap-1 bg-vermilion px-2 py-0.5 text-[10px] font-mono font-semibold text-white"
            >
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              +15.0s Extended
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-4">
        <div
          className={`font-mono font-semibold tabular-nums tracking-tight leading-none ${
            isUrgent ? "text-[#FF6B59]" : "text-podium-ink"
          }`}
          aria-live="off"
        >
          <span className="text-[2rem] sm:text-[2.25rem]">
            {mm}:{ss}
          </span>
          <span
            className={`text-lg sm:text-xl ${
              isUrgent ? "text-[#FFB4AA]" : "text-[#8FB4A3]"
            }`}
          >
            .{mmm}
          </span>
        </div>

        <span className="text-right font-mono text-[11px] text-[#A2BFB2]">
          Rule: Bid &lt; 10s
          <br />
          resets +15.0s
        </span>
      </div>
    </div>
  );
}
