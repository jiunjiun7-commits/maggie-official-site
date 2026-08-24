import Sidebar from "@/app/admin/_components/Sidebar";
import { listPendingNotificationEvents } from "@/lib/market-radar-store";
import NotificationsBoard from "./NotificationsBoard";
import "../../login/login.css";
import "../market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarNotificationsPage() {
  const events = await listPendingNotificationEvents();

  return (
    <div className="admin-page">
      <Sidebar />
      <NotificationsBoard events={events} />
    </div>
  );
}
