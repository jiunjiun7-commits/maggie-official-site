import Topbar from "@/app/_components/Topbar";
import { getChallengeDashboard } from "@/lib/ig-challenge-store";
import IgGrowthBoard from "./IgGrowthBoard";
import "../login/login.css";
import "./ig-growth.css";

export const dynamic = "force-dynamic";

export default async function IgGrowthPage() {
  const dashboard = await getChallengeDashboard();

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <IgGrowthBoard initialDashboard={dashboard} />
    </div>
  );
}
