import { NextResponse } from "next/server";
import { getReel, updateReel, type ExperimentResult, type MotherReelType } from "@/lib/ig-reel-store";

const EXPERIMENT_RESULTS: ExperimentResult[] = ["win", "neutral", "lose", "inconclusive"];
const MOTHER_REEL_TYPES: MotherReelType[] = ["traffic", "follow", "trust", "share", "save"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reel = await getReel(id);
  if (!reel) return NextResponse.json({ ok: false, error: "找不到這支 Reel。" }, { status: 404 });
  return NextResponse.json({ ok: true, reel });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const experimentResult = EXPERIMENT_RESULTS.includes(body.experimentResult) ? body.experimentResult : null;
  const motherReelType = MOTHER_REEL_TYPES.includes(body.motherReelType) ? body.motherReelType : null;

  const reel = await updateReel(id, {
    experimentResult,
    experimentWhatWorked: String(body.experimentWhatWorked || ""),
    experimentWhatFailed: String(body.experimentWhatFailed || ""),
    experimentShouldRepeat: String(body.experimentShouldRepeat || ""),
    experimentShouldChange: String(body.experimentShouldChange || ""),
    motherReelType,
    dnaNotes: String(body.dnaNotes || "")
  });

  if (!reel) return NextResponse.json({ ok: false, error: "找不到這支 Reel。" }, { status: 404 });
  return NextResponse.json({ ok: true, reel });
}
