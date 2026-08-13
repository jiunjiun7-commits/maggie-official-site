import Sidebar from "@/app/admin/_components/Sidebar";
import { getChallengeDashboard } from "@/lib/ig-challenge-store";
import { listPendingReminders } from "@/lib/ig-reel-store";
import IgGrowthBoard from "./IgGrowthBoard";
import "../login/login.css";
import "./ig-growth.css";

export const dynamic = "force-dynamic";

export default async function IgGrowthPage() {
  const [dashboard, reminders] = await Promise.all([getChallengeDashboard(), listPendingReminders()]);

  return (
    <div className="admin-page">
      <Sidebar />
      <IgGrowthBoard initialDashboard={dashboard} reminders={reminders} />
    </div>
  );
}
