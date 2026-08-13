import { NextResponse } from "next/server";
import { upsertSnapshot, type SnapshotStage } from "@/lib/ig-reel-store";

const STAGES: SnapshotStage[] = ["24h", "72h", "7d", "final"];

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (!STAGES.includes(body.stage)) {
    return NextResponse.json({ ok: false, error: "stage 必須是 24h / 72h / 7d / final。" }, { status: 400 });
  }

  const snapshot = await upsertSnapshot(id, body.stage as SnapshotStage, {
    views: num(body.views),
    reach: num(body.reach),
    likes: num(body.likes),
    comments: num(body.comments),
    shares: num(body.shares),
    saves: num(body.saves),
    follows: num(body.follows),
    profileVisits: num(body.profileVisits),
    avgWatchTimeSec: num(body.avgWatchTimeSec),
    nonFollowerPct: num(body.nonFollowerPct),
    reelsTabPct: num(body.reelsTabPct),
    explorePct: num(body.explorePct),
    feedPct: num(body.feedPct),
    storiesPct: num(body.storiesPct),
    isPaidBoost: Boolean(body.isPaidBoost),
    adSpend: num(body.adSpend),
    paidViews: num(body.paidViews),
    paidReach: num(body.paidReach),
    paidProfileVisits: num(body.paidProfileVisits),
    paidFollowers: num(body.paidFollowers)
  });

  return NextResponse.json({ ok: true, snapshot });
}
