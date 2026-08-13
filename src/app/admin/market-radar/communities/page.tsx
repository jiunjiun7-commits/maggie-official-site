import Topbar from "@/app/_components/Topbar";
import { listAreas, listCommunities } from "@/lib/market-radar-store";
import CommunitiesBoard from "./CommunitiesBoard";
import "../../login/login.css";
import "../market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarCommunitiesPage() {
  const [communities, areas] = await Promise.all([listCommunities(), listAreas()]);

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <CommunitiesBoard areas={areas} initialCommunities={communities} />
    </div>
  );
}
