import Sidebar from "@/app/admin/_components/Sidebar";
import { listAreas, listCommunities } from "@/lib/market-radar-store";
import CommunitiesBoard from "./CommunitiesBoard";
import "../../login/login.css";
import "../market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarCommunitiesPage() {
  const [communities, areas] = await Promise.all([listCommunities(), listAreas()]);

  return (
    <div className="admin-page">
      <Sidebar />
      <CommunitiesBoard areas={areas} initialCommunities={communities} />
    </div>
  );
}
