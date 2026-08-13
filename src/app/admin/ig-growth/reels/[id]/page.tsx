import { notFound } from "next/navigation";
import Sidebar from "@/app/admin/_components/Sidebar";
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
      <Sidebar />
      <ReelDetailBoard initialReel={reel} initialSnapshots={snapshots} />
    </div>
  );
}
