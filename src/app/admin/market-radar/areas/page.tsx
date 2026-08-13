import Topbar from "@/app/_components/Topbar";
import { listAreas } from "@/lib/market-radar-store";
import AreasBoard from "./AreasBoard";
import "../../login/login.css";
import "../market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarAreasPage() {
  const areas = await listAreas();

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <AreasBoard initialAreas={areas} />
    </div>
  );
}
