"use client";

import { useState } from "react";
import { SlidersHorizontal, X, TimerReset, Zap, ShieldAlert, RotateCcw } from "lucide-react";

interface QaDrawerProps {
  forceOutbid: boolean;
  onToggleForceOutbid: () => void;
  onJumpToSnipeWindow: () => void;
  onTriggerRivalBid: () => void;
  onResetLot: () => void;
}

export function QaDrawer({
  forceOutbid,
  onToggleForceOutbid,
  onJumpToSnipeWindow,
  onTriggerRivalBid,
  onResetLot,
}: QaDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open ? (
        <div className="w-[300px] border border-border-strong bg-surface p-3.5 text-ink shadow-[0_12px_32px_rgba(23,22,20,0.14)]">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-podium">
              Showcase / QA Controls
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-ink-muted hover:text-ink transition-colors"
              aria-label="Close Showcase / QA drawer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={onJumpToSnipeWindow}
              className="flex items-center justify-between border border-border bg-ground px-2.5 py-2 text-left text-xs font-medium text-ink hover:border-podium transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <TimerReset className="h-3.5 w-3.5 text-vermilion" />
                Jump Clock to 00:08.500
              </span>
              <span className="font-mono text-[10px] text-ink-muted">ANTI-SNIPE</span>
            </button>

            <button
              type="button"
              onClick={onToggleForceOutbid}
              className={`flex items-center justify-between border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                forceOutbid
                  ? "border-vermilion bg-[#FAE8E5] text-[#8E1C0E]"
                  : "border-border bg-ground text-ink hover:border-podium"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-vermilion" />
                Force Next Bid Outbid
              </span>
              <span className="font-mono text-[10px] font-semibold">
                {forceOutbid ? "ARMED" : "OFF"}
              </span>
            </button>

            <button
              type="button"
              onClick={onTriggerRivalBid}
              className="flex items-center justify-between border border-border bg-ground px-2.5 py-2 text-left text-xs font-medium text-ink hover:border-podium transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-podium" />
                Trigger Rival Bid Now
              </span>
              <span className="font-mono text-[10px] text-ink-muted">SSE SIM</span>
            </button>

            <button
              type="button"
              onClick={onResetLot}
              className="flex items-center justify-between border border-border bg-ground px-2.5 py-2 text-left text-xs font-medium text-ink hover:border-podium transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-ink-muted" />
                Reset Active Lot
              </span>
              <span className="font-mono text-[10px] text-ink-muted">FRESH</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/95 px-3.5 py-1.5 font-mono text-[11px] font-medium text-ink shadow-[0_4px_14px_rgba(23,22,20,0.08)] hover:border-podium hover:text-podium transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-podium" />
          Showcase / QA
        </button>
      )}
    </div>
  );
}
