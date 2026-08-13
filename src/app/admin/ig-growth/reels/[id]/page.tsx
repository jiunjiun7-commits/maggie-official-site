import { notFound } from "next/navigation";
import Topbar from "@/app/_components/Topbar";
import { getReel, listSnapshots } from "@/lib/ig-reel-store";
import ReelDetailBoard from "./ReelDetailBoard";
import "../../../login/login.css";
import "../../ig-growth.css";

export const dynamic = "force-dynamic";

export default async function IgReelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reel = await getReel(id);
  if (!reel) notFound();

  const snapshots = await listSnapshots(id);

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <ReelDetailBoard initialReel={reel} initialSnapshots={snapshots} />
    </div>
  );
}
