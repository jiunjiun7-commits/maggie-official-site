import { notFound } from "next/navigation";
import Sidebar from "@/app/admin/_components/Sidebar";
import { getArea, listAreaRules } from "@/lib/market-radar-store";
import AreaDetailBoard from "./AreaDetailBoard";
import "../../../login/login.css";
import "../../market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarAreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const area = await getArea(id);
  if (!area) notFound();
  const rules = await listAreaRules(id);

  return (
    <div className="admin-page">
      <Sidebar />
      <AreaDetailBoard initialArea={area} initialRules={rules} />
    </div>
  );
}
