import Topbar from "@/app/_components/Topbar";
import { listLatestSnapshotByReel, listReels } from "@/lib/ig-reel-store";
import ReelsBoard from "./ReelsBoard";
import "../../login/login.css";
import "../ig-growth.css";

export const dynamic = "force-dynamic";

export default async function IgReelsPage() {
  const [reels, latestByReel] = await Promise.all([listReels(), listLatestSnapshotByReel()]);
  const rows = reels.map((reel) => ({ reel, latest: latestByReel.get(reel.id) ?? null }));

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <ReelsBoard initialRows={rows} />
    </div>
  );
}
