import Sidebar from "@/app/admin/_components/Sidebar";
import { getChallengeDashboard } from "@/lib/ig-challenge-store";
import IgGrowthBoard from "./IgGrowthBoard";
import "../login/login.css";
import "./ig-growth.css";

export const dynamic = "force-dynamic";

export default async function IgGrowthPage() {
  const dashboard = await getChallengeDashboard();

  return (
    <div className="admin-page">
      <Sidebar />
      <IgGrowthBoard initialDashboard={dashboard} />
    </div>
  );
}
