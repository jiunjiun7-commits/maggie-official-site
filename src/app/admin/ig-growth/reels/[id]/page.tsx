import { notFound } from "next/navigation";
import Sidebar from "@/app/admin/_components/Sidebar";
import { getReel, listSnapshots, type SnapshotStage } from "@/lib/ig-reel-store";
import ReelDetailBoard from "./ReelDetailBoard";
import "../../../login/login.css";
import "../../ig-growth.css";

export const dynamic = "force-dynamic";

const VALID_STAGES: SnapshotStage[] = ["24h", "72h", "7d", "final"];

export default async function IgReelDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { id } = await params;
  const { stage } = await searchParams;
  const reel = await getReel(id);
  if (!reel) notFound();

  const snapshots = await listSnapshots(id);
  const initialStage: SnapshotStage = VALID_STAGES.includes(stage as SnapshotStage) ? (stage as SnapshotStage) : "24h";

  return (
    <div className="admin-page">
      <Sidebar />
      <ReelDetailBoard initialReel={reel} initialSnapshots={snapshots} initialStage={initialStage} />
    </div>
  );
}
