import Sidebar from "@/app/admin/_components/Sidebar";
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
      <Sidebar />
      <ReelsBoard initialRows={rows} />
    </div>
  );
}
