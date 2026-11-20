import { NextRequest, NextResponse } from "next/server";
import { INITIAL_LOTS, RIVAL_BIDDERS } from "@/lib/auction-data";

export const dynamic = "force-dynamic";

interface BidBody {
  lotId?: string;
  amount?: number;
  currentBid?: number;
  endsAt?: number;
  forceOutbid?: boolean;
  paddle?: string;
}

export async function POST(request: NextRequest) {
  let body: BidBody;
  try {
    body = (await request.json()) as BidBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON bid payload." },
      { status: 400 }
    );
  }

  const lot = INITIAL_LOTS.find((l) => l.id === body.lotId) ?? INITIAL_LOTS[0];
  const currentBid = Number(body.currentBid ?? lot.openingBid);
  const amount = Number(body.amount ?? 0);
  const now = Date.now();
  const endsAt = Number(body.endsAt ?? now + lot.durationMs);

  // Brief realistic network confirmation latency so useOptimistic visibly shines
  await new Promise((resolve) => setTimeout(resolve, 360));

  if (endsAt <= now) {
    return NextResponse.json(
      {
        ok: false,
        reason: "CLOSED",
        message: "Hammer has already fallen on this lot.",
      },
      { status: 410 }
    );
  }

  if (!Number.isFinite(amount) || amount <= currentBid) {
    return NextResponse.json(
      {
        ok: false,
        reason: "STALE_AMOUNT",
        message: `Bid must exceed current standing price of CHF ${currentBid.toLocaleString("en-US")}.`,
      },
      { status: 400 }
    );
  }

  // Deterministic QA rollback OR ~12% organic rival collision race condition
  const shouldOutbid = Boolean(body.forceOutbid) || Math.random() < 0.12;

  if (shouldOutbid) {
    const rival =
      RIVAL_BIDDERS[Math.floor(Math.random() * RIVAL_BIDDERS.length)];
    const rivalAmount = amount + lot.incrementSteps[0];
    const remaining = endsAt - Date.now();
    const nextEndsAt = remaining < 10_000 ? Date.now() + 15_000 : endsAt;

    return NextResponse.json(
      {
        ok: false,
        reason: "OUTBID",
        message: `Superseded in transit by ${rival.bidder} (${rival.paddle}) at CHF ${rivalAmount.toLocaleString("en-US")}.`,
        rivalBid: {
          id: `rival-${Date.now()}`,
          bidder: rival.bidder,
          paddle: rival.paddle,
          channel: rival.channel,
          amount: rivalAmount,
          timestamp: Date.now(),
        },
        endsAt: nextEndsAt,
        extended: remaining < 10_000,
      },
      { status: 200 }
    );
  }

  const remaining = endsAt - Date.now();
  const extended = remaining < 10_000;
  const nextEndsAt = extended ? Date.now() + 15_000 : endsAt;

  return NextResponse.json({
    ok: true,
    extended,
    endsAt: nextEndsAt,
    bid: {
      id: `user-${Date.now()}`,
      bidder: "You (Registered Paddle)",
      paddle: body.paddle ?? "#884",
      channel: "YOU" as const,
      amount,
      timestamp: Date.now(),
    },
  });
}
