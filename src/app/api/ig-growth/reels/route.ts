import { NextResponse } from "next/server";
import {
  createReel,
  listReels,
  type ContentEngine,
  type Mission
} from "@/lib/ig-reel-store";

const ENGINES: ContentEngine[] = ["discovery", "follow", "trust"];
const MISSION_KEYS: Mission[] = ["reach", "follow", "trust", "engagement", "brand"];

export async function GET() {
  const reels = await listReels();
  return NextResponse.json({ ok: true, reels });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const publishedDate = String(body.publishedDate || "").trim();
  const title = String(body.title || "").trim();
  const contentEngine = ENGINES.includes(body.contentEngine) ? (body.contentEngine as ContentEngine) : null;
  const primaryMission = MISSION_KEYS.includes(body.primaryMission) ? (body.primaryMission as Mission) : null;
  const secondaryMission = MISSION_KEYS.includes(body.secondaryMission) ? (body.secondaryMission as Mission) : null;

  if (!publishedDate || !title || !contentEngine || !primaryMission) {
    return NextResponse.json(
      { ok: false, error: "發布日期、影片名稱、Content Engine、Primary Mission 為必填。" },
      { status: 400 }
    );
  }

  const reel = await createReel({
    publishedDate,
    title,
    series: String(body.series || ""),
    episode: String(body.episode || ""),
    contentEngine,
    primaryMission,
    secondaryMission,
    hook: String(body.hook || ""),
    coverText: String(body.coverText || ""),
    captionCta: String(body.captionCta || ""),
    videoLengthSec: body.videoLengthSec ? Number(body.videoLengthSec) : null,
    reelUrl: String(body.reelUrl || ""),
    experimentHypothesis: String(body.experimentHypothesis || ""),
    experimentResult: null,
    experimentWhatWorked: "",
    experimentWhatFailed: "",
    experimentShouldRepeat: "",
    experimentShouldChange: "",
    motherReelType: null,
    dnaNotes: ""
  });

  return NextResponse.json({ ok: true, reel });
}
