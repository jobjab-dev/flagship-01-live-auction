"use client";

import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Gavel,
  Radio,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  AuctionLot,
  BidEntry,
  INITIAL_LOTS,
  RIVAL_BIDDERS,
  formatCurrency,
} from "@/lib/auction-data";
import { AnimatedTicker } from "@/components/AnimatedTicker";
import { PrecisionClock } from "@/components/PrecisionClock";
import { QaDrawer } from "@/components/QaDrawer";

interface LotLiveState {
  currentBid: number;
  bids: BidEntry[];
  endsAt: number;
  lastExtendedAt: number | null;
  closed: boolean;
}

type OptimisticAction =
  | { type: "ADD_OPTIMISTIC_BID"; bid: BidEntry; amount: number }
  | { type: "ROLLBACK_SYNC" };

function buildInitialLotStates(anchorNow: number): Record<string, LotLiveState> {
  const states: Record<string, LotLiveState> = {};
  for (const lot of INITIAL_LOTS) {
    states[lot.id] = {
      currentBid: lot.openingBid,
      bids: lot.initialBids.map((b) => ({
        ...b,
        timestamp: anchorNow > 0 ? anchorNow + b.timestamp : b.timestamp,
      })),
      endsAt: anchorNow > 0 ? anchorNow + lot.durationMs : 0,
      lastExtendedAt: null,
      closed: false,
    };
  }
  return states;
}

function formatRelativeTime(timestamp: number, now: number): string {
  if (now <= 0) {
    const absSec = Math.max(1, Math.floor(Math.abs(timestamp) / 1000));
    return absSec < 60 ? `${absSec}s ago` : `${Math.floor(absSec / 60)}m ago`;
  }
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 2) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
}

export function AuctionSaleroom() {
  const [activeLotId, setActiveLotId] = useState<string>(INITIAL_LOTS[0].id);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [lotStates, setLotStates] = useState<Record<string, LotLiveState>>(() =>
    buildInitialLotStates(0)
  );
  const [streamStatus, setStreamStatus] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");
  const [clockNow, setClockNow] = useState<number>(0);
  const [customIncrement, setCustomIncrement] = useState<string>("");
  const [forceOutbid, setForceOutbid] = useState<boolean>(false);
  const [alertNotice, setAlertNotice] = useState<{
    kind: "rollback" | "extended" | "confirmed" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeLot: AuctionLot =
    INITIAL_LOTS.find((l) => l.id === activeLotId) ?? INITIAL_LOTS[0];
  const activeState = lotStates[activeLot.id];

  // Keep latest bid/endsAt accessible for EventSource reconnects without restarting every second
  const latestRef = useRef(activeState);
  latestRef.current = activeState;

  // React 19 useOptimistic: instantaneously renders user bid before server confirmation
  // and cleanly rolls back if the authoritative state supersedes or rejects it.
  const [optimisticLot, addOptimisticBid] = useOptimistic<
    LotLiveState,
    OptimisticAction
  >(activeState, (state, action) => {
    if (action.type === "ADD_OPTIMISTIC_BID") {
      return {
        ...state,
        currentBid: action.amount,
        bids: [action.bid, ...state.bids].slice(0, 14),
      };
    }
    return state;
  });

  // Initialize real client timestamps strictly after hydration to avoid SSR/client mismatch
  useEffect(() => {
    const now = Date.now();
    setLotStates(buildInitialLotStates(now));
    setClockNow(now);
    setHydrated(true);
    const id = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss transient feedback notices
  useEffect(() => {
    if (!alertNotice) return;
    const t = setTimeout(() => setAlertNotice(null), 5500);
    return () => clearTimeout(t);
  }, [alertNotice]);

  // Live Server-Sent Events subscription per active lot
  useEffect(() => {
    if (!hydrated) return;
    const snapshot = latestRef.current;
    if (snapshot.closed || snapshot.endsAt <= Date.now()) {
      setStreamStatus("live");
      return;
    }

    setStreamStatus("connecting");
    const url = `/api/stream?lotId=${encodeURIComponent(
      activeLot.id
    )}&currentBid=${snapshot.currentBid}&endsAt=${snapshot.endsAt}`;
    const source = new EventSource(url);

    source.addEventListener("connected", () => {
      setStreamStatus("live");
    });

    source.addEventListener("bid", (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as {
          lotId: string;
          bid: BidEntry;
          endsAt: number;
          extended?: boolean;
        };

        setLotStates((prev) => {
          const cur = prev[data.lotId];
          if (!cur || data.bid.amount <= cur.currentBid || cur.closed) {
            return prev;
          }
          return {
            ...prev,
            [data.lotId]: {
              ...cur,
              currentBid: data.bid.amount,
              bids: [data.bid, ...cur.bids].slice(0, 14),
              endsAt: Math.max(cur.endsAt, data.endsAt),
              lastExtendedAt: data.extended ? Date.now() : cur.lastExtendedAt,
            },
          };
        });
      } catch {
        // Ignore malformed frame
      }
    });

    source.addEventListener("hammer", () => {
      setLotStates((prev) => ({
        ...prev,
        [activeLot.id]: {
          ...prev[activeLot.id],
          closed: true,
        },
      }));
    });

    source.onerror = () => {
      setStreamStatus("reconnecting");
    };

    return () => {
      source.close();
    };
  }, [activeLot.id, hydrated]);

  const handlePlaceBid = useCallback(
    (targetAmount: number) => {
      if (activeState.closed || activeState.endsAt <= Date.now()) return;
      if (targetAmount <= optimisticLot.currentBid) return;

      const optimisticEntry: BidEntry = {
        id: `opt-${Date.now()}`,
        bidder: "You (Registered Paddle)",
        paddle: "#884",
        channel: "YOU",
        amount: targetAmount,
        timestamp: Date.now(),
        pending: true,
      };

      setAlertNotice(null);

      startTransition(async () => {
        addOptimisticBid({
          type: "ADD_OPTIMISTIC_BID",
          bid: optimisticEntry,
          amount: targetAmount,
        });

        try {
          const res = await fetch("/api/bid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lotId: activeLot.id,
              amount: targetAmount,
              currentBid: activeState.currentBid,
              endsAt: activeState.endsAt,
              forceOutbid,
              paddle: "#884",
            }),
          });

          const payload = (await res.json()) as {
            ok: boolean;
            reason?: string;
            message?: string;
            extended?: boolean;
            endsAt?: number;
            bid?: BidEntry;
            rivalBid?: BidEntry;
          };

          if ((res.status === 409 || payload.reason === "OUTBID") && payload.rivalBid) {
            // Authoritative state moves directly to the rival's bid -> useOptimistic rolls back your bid
            setLotStates((prev) => {
              const cur = prev[activeLot.id];
              const nextBids =
                payload.rivalBid && payload.rivalBid.amount > cur.currentBid
                  ? [payload.rivalBid, ...cur.bids].slice(0, 14)
                  : cur.bids;
              return {
                ...prev,
                [activeLot.id]: {
                  ...cur,
                  currentBid: Math.max(cur.currentBid, payload.rivalBid!.amount),
                  bids: nextBids,
                  endsAt: payload.endsAt
                    ? Math.max(cur.endsAt, payload.endsAt)
                    : cur.endsAt,
                  lastExtendedAt: payload.extended
                    ? Date.now()
                    : cur.lastExtendedAt,
                },
              };
            });
            setAlertNotice({
              kind: "rollback",
              text:
                payload.message ??
                "Optimistic bid rolled back — superseded in transit by another paddle.",
            });
            return;
          }

          if (!res.ok || !payload.ok || !payload.bid) {
            addOptimisticBid({ type: "ROLLBACK_SYNC" });
            setAlertNotice({
              kind: "error",
              text: payload.message ?? "Bid could not be recorded.",
            });
            return;
          }

          setLotStates((prev) => {
            const cur = prev[activeLot.id];
            return {
              ...prev,
              [activeLot.id]: {
                ...cur,
                currentBid: Math.max(cur.currentBid, payload.bid!.amount),
                bids: [payload.bid!, ...cur.bids].slice(0, 14),
                endsAt: payload.endsAt
                  ? Math.max(cur.endsAt, payload.endsAt)
                  : cur.endsAt,
                lastExtendedAt: payload.extended
                  ? Date.now()
                  : cur.lastExtendedAt,
              },
            };
          });

          if (payload.extended) {
            setAlertNotice({
              kind: "extended",
              text: `Bid confirmed at ${formatCurrency(payload.bid.amount)}. Anti-snipe extended closing clock by +15.0s.`,
            });
          } else {
            setAlertNotice({
              kind: "confirmed",
              text: `Leading paddle #884 at ${formatCurrency(payload.bid.amount)}.`,
            });
          }
        } catch {
          addOptimisticBid({ type: "ROLLBACK_SYNC" });
          setAlertNotice({
            kind: "error",
            text: "Network interruption — optimistic bid rolled back cleanly.",
          });
        }
      });
    },
    [
      activeLot.id,
      activeState.closed,
      activeState.currentBid,
      activeState.endsAt,
      addOptimisticBid,
      forceOutbid,
      optimisticLot.currentBid,
    ]
  );

  const handleJumpToSnipeWindow = () => {
    setLotStates((prev) => ({
      ...prev,
      [activeLot.id]: {
        ...prev[activeLot.id],
        endsAt: Date.now() + 8500,
        closed: false,
      },
    }));
    setAlertNotice({
      kind: "extended",
      text: "Clock set to 00:08.500 — place any bid now to trigger +15.0s Anti-Snipe extension.",
    });
  };

  const handleTriggerInstantRival = () => {
    const now = Date.now();
    const rival =
      RIVAL_BIDDERS[Math.floor(Math.random() * RIVAL_BIDDERS.length)];
    setLotStates((prev) => {
      const cur = prev[activeLot.id];
      if (cur.closed) return prev;
      const nextAmount = cur.currentBid + activeLot.incrementSteps[0];
      const shouldExtend = cur.endsAt - now < 10_000;
      return {
        ...prev,
        [activeLot.id]: {
          ...cur,
          currentBid: nextAmount,
          bids: [
            {
              id: `qa-rival-${now}`,
              bidder: rival.bidder,
              paddle: rival.paddle,
              channel: rival.channel,
              amount: nextAmount,
              timestamp: now,
            },
            ...cur.bids,
          ].slice(0, 14),
          endsAt: shouldExtend ? now + 15_000 : cur.endsAt,
          lastExtendedAt: shouldExtend ? now : cur.lastExtendedAt,
        },
      };
    });
  };

  const handleResetLot = () => {
    const now = Date.now();
    setLotStates((prev) => ({
      ...prev,
      [activeLot.id]: {
        currentBid: activeLot.openingBid,
        bids: activeLot.initialBids.map((b) => ({
          ...b,
          timestamp: now + b.timestamp,
        })),
        endsAt: now + activeLot.durationMs,
        lastExtendedAt: null,
        closed: false,
      },
    }));
    setAlertNotice(null);
    setForceOutbid(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(customIncrement.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= optimisticLot.currentBid) {
      setAlertNotice({
        kind: "error",
        text: `Custom bid must be above ${formatCurrency(optimisticLot.currentBid)}.`,
      });
      return;
    }
    setCustomIncrement("");
    handlePlaceBid(parsed);
  };

  const leadingBid = optimisticLot.bids[0];
  const isUserLeading = leadingBid?.channel === "YOU";
  const hasOptimisticPending = optimisticLot.bids.some((b) => b.pending);

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink">
      {/* Top Saleroom Masthead */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl font-bold uppercase tracking-tight text-ink">
              HÄNSEL &amp; ROTH
            </span>
            <span className="hidden sm:inline font-mono text-xs text-ink-muted">
              ZURICH SALE NO. 2611 · HOROLOGY &amp; INDUSTRIAL OBJECTS
            </span>
          </div>

          <div className="flex items-center gap-5 font-mono text-xs">
            <span className="hidden md:inline text-ink-muted">
              PADDLE <strong className="text-ink">#884</strong>
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 border ${
                streamStatus === "live"
                  ? "border-podium/30 bg-[#E6EFEA] text-podium"
                  : "border-border-strong bg-ground text-ink-muted"
              }`}
            >
              {streamStatus === "reconnecting" ? (
                <WifiOff className="h-3.5 w-3.5" />
              ) : (
                <Radio className="h-3.5 w-3.5 animate-pulse" />
              )}
              <span>
                {streamStatus === "live"
                  ? "SSE STREAM LIVE"
                  : streamStatus === "connecting"
                    ? "CONNECTING SSE"
                    : "RECONNECTING SSE"}
              </span>
            </span>
          </div>
        </div>

        {/* Lot Switcher Strip */}
        <nav
          aria-label="Auction Catalog Lots"
          className="border-t border-border bg-ground/70"
        >
          <div className="mx-auto flex max-w-[1400px] overflow-x-auto px-5 sm:px-8">
            {INITIAL_LOTS.map((lot) => {
              const state = lotStates[lot.id];
              const active = lot.id === activeLot.id;
              return (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => {
                    setActiveLotId(lot.id);
                    setAlertNotice(null);
                  }}
                  className={`flex shrink-0 items-center gap-3 border-r border-border px-4 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-podium text-podium-ink"
                      : "bg-transparent text-ink hover:bg-surface"
                  }`}
                >
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      active ? "text-[#A7E3C6]" : "text-ink-muted"
                    }`}
                  >
                    {lot.lotNumber}
                  </span>
                  <span className="text-xs font-medium max-w-[170px] truncate">
                    {lot.title}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      active ? "text-podium-ink" : "text-podium"
                    }`}
                  >
                    {formatCurrency(state.currentBid)}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Asymmetric Saleroom Workspace */}
      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 lg:grid-cols-12">
        {/* Left Exhibition Stage (7 Columns) */}
        <section className="flex flex-col border-b border-border lg:col-span-7 lg:border-b-0 lg:border-r">
          <div className="flex-1 p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-border">
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.04] tracking-tight text-ink">
                {activeLot.lotNumber} — {activeLot.title}
              </h1>
              <span className="font-mono text-xs text-ink-muted shrink-0">
                EST. {formatCurrency(activeLot.estimateLow)} –{" "}
                {formatCurrency(activeLot.estimateHigh)}
              </span>
            </div>

            {/* Sunlit Studio Exhibition Plate */}
            <div className="mt-6 overflow-hidden border border-border bg-surface">
              <div className="aspect-[4/3] w-full overflow-hidden bg-ground">
                <img
                  src={activeLot.image}
                  alt={activeLot.imageAlt}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.015]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 font-mono text-[11px] text-ink-muted">
                <span>
                  {activeLot.maker} · {activeLot.year}
                </span>
                <span>{activeLot.condition}</span>
              </div>
            </div>

            {/* Provenance & Technical Specifications */}
            <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-12">
              <div className="md:col-span-7">
                <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-podium">
                  Saleroom Provenance Note
                </h2>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink max-w-[64ch]">
                  {activeLot.provenance}
                </p>
              </div>
              <dl className="md:col-span-5 divide-y divide-border border border-border bg-surface">
                {activeLot.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex items-baseline justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <dt className="font-mono uppercase tracking-wider text-ink-muted">
                      {spec.label}
                    </dt>
                    <dd className="text-right font-medium text-ink">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Right Alpine Forest Podium Rail (5 Columns) */}
        <aside className="flex flex-col bg-podium text-podium-ink lg:col-span-5">
          <div className="flex flex-col gap-5 p-5 sm:p-7">
            {/* Millisecond Anti-Snipe Clock */}
            <PrecisionClock
              endsAt={activeState.endsAt}
              durationFallbackMs={activeLot.durationMs}
              lastExtendedAt={activeState.lastExtendedAt}
              onExpire={() => {
                setLotStates((prev) => ({
                  ...prev,
                  [activeLot.id]: {
                    ...prev[activeLot.id],
                    closed: true,
                  },
                }));
              }}
            />

            {/* Current Standing Bid Ticker */}
            <div className="border-b border-[#285443] pb-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-[#B6D0C4]">
                  {activeState.closed
                    ? "Final Hammer Price"
                    : hasOptimisticPending
                      ? "Optimistic Bid In Flight..."
                      : "Current Standing Bid"}
                </span>
                <span
                  className={`font-mono text-[11px] px-2 py-0.5 border ${
                    isUserLeading
                      ? "border-[#8CE0B8] bg-[#1D543F] text-[#E6FFF3]"
                      : "border-[#2D624E] bg-[#0E3024] text-[#B6D0C4]"
                  }`}
                >
                  {isUserLeading
                    ? "YOU LEAD · PADDLE #884"
                    : `LEADING ${leadingBid?.paddle ?? "#000"}`}
                </span>
              </div>

              <div className="mt-3">
                <AnimatedTicker
                  value={optimisticLot.currentBid}
                  optimistic={hasOptimisticPending}
                />
              </div>

              <div className="mt-2 flex items-center justify-between font-mono text-xs text-[#9BBBAE]">
                <span>
                  Reserve Met ({formatCurrency(activeLot.reservePrice)})
                </span>
                <span>{optimisticLot.bids.length} Recorded Bids</span>
              </div>
            </div>

            {/* Optimistic Feedback / Rollback Alert Banner */}
            <AnimatePresence mode="wait">
              {alertNotice && (
                <motion.div
                  key={alertNotice.text}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`flex items-start gap-2.5 border px-3.5 py-2.5 text-xs leading-snug ${
                    alertNotice.kind === "rollback" || alertNotice.kind === "error"
                      ? "border-[#FF7362] bg-vermilion text-white"
                      : alertNotice.kind === "extended"
                        ? "border-[#FF9E92] bg-[#461812] text-[#FFDAD5]"
                        : "border-[#63B98F] bg-[#164A37] text-[#E8FAF0]"
                  }`}
                  role="status"
                >
                  {alertNotice.kind === "rollback" ||
                  alertNotice.kind === "error" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{alertNotice.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Bidding Paddles */}
            <div>
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-[#B6D0C4]">
                <span>Instant Floor &amp; Room Paddles</span>
                {forceOutbid && (
                  <span className="bg-vermilion px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    QA OUTBID ARMED
                  </span>
                )}
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {activeLot.incrementSteps.map((step, index) => {
                  const nextAmount = optimisticLot.currentBid + step;
                  return (
                    <button
                      key={step}
                      type="button"
                      disabled={activeState.closed || isPending}
                      onClick={() => handlePlaceBid(nextAmount)}
                      className={`group flex flex-col items-start justify-between border px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                        index === 0
                          ? "border-[#EAE4D7] bg-[#F5F2EA] text-ink hover:bg-white"
                          : "border-[#316350] bg-[#0E3024] text-podium-ink hover:border-[#8CE0B8] hover:bg-[#174635]"
                      }`}
                    >
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          index === 0 ? "text-podium" : "text-[#9ED6BC]"
                        }`}
                      >
                        +{formatCurrency(step)}
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums">
                        {formatCurrency(nextAmount)}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleCustomSubmit} className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={activeState.closed}
                  value={customIncrement}
                  onChange={(e) => setCustomIncrement(e.target.value)}
                  placeholder={`Custom max > ${optimisticLot.currentBid.toLocaleString("en-US")}`}
                  aria-label="Custom bid amount in CHF"
                  className="flex-1 border border-[#316350] bg-[#0B271D] px-3 py-2 font-mono text-xs text-podium-ink placeholder:text-[#7DA494] focus:border-[#8CE0B8] focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={activeState.closed || isPending}
                  className="inline-flex items-center gap-1.5 border border-[#8CE0B8] bg-[#184D39] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-podium-ink hover:bg-[#22664D] transition-colors disabled:opacity-45"
                >
                  <Gavel className="h-3.5 w-3.5" />
                  Bid
                </button>
              </form>
            </div>

            {/* Live Sliding Bid Ledger */}
            <div className="border-t border-[#285443] pt-4">
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-[#B6D0C4]">
                <span>Live Saleroom Ledger</span>
                <span className="inline-flex items-center gap-1">
                  <Wifi className="h-3 w-3" /> Real-time Feed
                </span>
              </div>

              <div className="mt-2.5 max-h-[300px] overflow-y-auto pr-1 divide-y divide-[#204738] border border-[#285443] bg-[#0B271D]">
                <AnimatePresence initial={false}>
                  {optimisticLot.bids.map((entry) => (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs ${
                        entry.channel === "YOU"
                          ? "bg-[#154533]"
                          : "bg-transparent"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#9ED6BC]">
                            {entry.paddle}
                          </span>
                          <span className="truncate font-medium text-podium-ink">
                            {entry.bidder}
                          </span>
                          {entry.pending && (
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[#F7D08A]">
                              Optimistic
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#88AB9B]">
                          {entry.channel} ·{" "}
                          {formatRelativeTime(entry.timestamp, clockNow)}
                        </div>
                      </div>

                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-podium-ink">
                        {formatCurrency(entry.amount)}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Subtle Footer Attribution */}
      <footer className="border-t border-border bg-surface px-5 py-3 sm:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink-muted">
          <span>
            HÄNSEL &amp; ROTH ZURICH · SSE + REACT 19 OPTIMISTIC BIDDING ENGINE
          </span>
          <span>
            Crafted by{" "}
            <a
              href="https://github.com/jobjab-dev"
              target="_blank"
              rel="noreferrer"
              className="text-podium underline underline-offset-4 hover:text-ink"
            >
              jobjab-dev
            </a>
          </span>
        </div>
      </footer>

      <QaDrawer
        forceOutbid={forceOutbid}
        onToggleForceOutbid={() => setForceOutbid((prev) => !prev)}
        onJumpToSnipeWindow={handleJumpToSnipeWindow}
        onTriggerRivalBid={handleTriggerInstantRival}
        onResetLot={handleResetLot}
      />
    </div>
  );
}
