import Sidebar from "@/app/admin/_components/Sidebar";
import { listAreas } from "@/lib/market-radar-store";
import AreasBoard from "./AreasBoard";
import "../../login/login.css";
import "../market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarAreasPage() {
  const areas = await listAreas();

  return (
    <div className="admin-page">
      <Sidebar />
      <AreasBoard initialAreas={areas} />
    </div>
  );
}
