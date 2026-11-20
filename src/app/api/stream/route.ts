import { NextRequest } from "next/server";
import { INITIAL_LOTS, RIVAL_BIDDERS } from "@/lib/auction-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lotId") ?? "lot-01";
  const lot = INITIAL_LOTS.find((item) => item.id === lotId) ?? INITIAL_LOTS[0];

  const parsedBid = Number(searchParams.get("currentBid"));
  let runningBid =
    Number.isFinite(parsedBid) && parsedBid > 0 ? parsedBid : lot.openingBid;

  const parsedEndsAt = Number(searchParams.get("endsAt"));
  let endsAt =
    Number.isFinite(parsedEndsAt) && parsedEndsAt > Date.now()
      ? parsedEndsAt
      : Date.now() + lot.durationMs;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let bidTimer: ReturnType<typeof setTimeout> | null = null;
      let pingTimer: ReturnType<typeof setInterval> | null = null;
      let closeTimer: ReturnType<typeof setTimeout> | null = null;

      const sendEvent = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
            )
          );
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (bidTimer) clearTimeout(bidTimer);
        if (pingTimer) clearInterval(pingTimer);
        if (closeTimer) clearTimeout(closeTimer);
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);

      // Instruct client EventSource to reconnect rapidly after clean cycle end
      controller.enqueue(encoder.encode("retry: 1500\n\n"));

      sendEvent("connected", {
        lotId: lot.id,
        serverTime: Date.now(),
        currentBid: runningBid,
        endsAt,
      });

      const scheduleNextRivalBid = () => {
        if (closed) return;
        const delayMs = 3600 + Math.floor(Math.random() * 2800);
        bidTimer = setTimeout(() => {
          if (closed) return;
          const now = Date.now();
          if (now >= endsAt) {
            sendEvent("hammer", { lotId: lot.id, finalBid: runningBid, closedAt: now });
            cleanup();
            return;
          }

          const stepPool = lot.incrementSteps;
          const chosenStep =
            stepPool[Math.floor(Math.random() * Math.min(2, stepPool.length))];
          runningBid += chosenStep;

          const rival =
            RIVAL_BIDDERS[Math.floor(Math.random() * RIVAL_BIDDERS.length)];

          let extended = false;
          if (endsAt - now < 10_000) {
            endsAt = now + 15_000;
            extended = true;
          }

          sendEvent("bid", {
            lotId: lot.id,
            bid: {
              id: `sse-${now}-${Math.random().toString(36).slice(2, 6)}`,
              bidder: rival.bidder,
              paddle: rival.paddle,
              channel: rival.channel,
              amount: runningBid,
              timestamp: now,
            },
            endsAt,
            extended,
          });

          scheduleNextRivalBid();
        }, delayMs);
      };

      scheduleNextRivalBid();

      pingTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      }, 8000);

      // Cleanly recycle connection before serverless execution limits
      closeTimer = setTimeout(() => {
        sendEvent("recycle", { currentBid: runningBid, endsAt });
        cleanup();
      }, 22000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
