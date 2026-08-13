import { NextResponse } from "next/server";
import { getChallengeDashboard, todayDateTaipei, upsertFollowersLog } from "@/lib/ig-challenge-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const followers = Number(body.followers);

  if (!Number.isFinite(followers) || followers < 0) {
    return NextResponse.json({ ok: false, error: "Followers 必須是正整數。" }, { status: 400 });
  }

  await upsertFollowersLog(todayDateTaipei(), Math.round(followers));
  const dashboard = await getChallengeDashboard();
  return NextResponse.json({ ok: true, dashboard });
}
