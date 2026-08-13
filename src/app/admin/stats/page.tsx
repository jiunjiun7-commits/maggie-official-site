import Sidebar from "@/app/admin/_components/Sidebar";
import { listAppointments } from "@/lib/appointment-store";
import { getEventCounts } from "@/lib/events-store";
import { statsRangeTaipei, visitCountInRange, type StatsRange } from "@/lib/visit-counter";
import StatsBoard from "./StatsBoard";
import "../login/login.css";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range: StatsRange = ["today", "7d", "30d"].includes(params.range || "")
    ? (params.range as StatsRange)
    : "7d";

  const bounds = statsRangeTaipei(range);
  const [visits, events, appointments] = await Promise.all([
    visitCountInRange(bounds),
    getEventCounts(bounds),
    listAppointments("all")
  ]);

  const completed = appointments.filter(
    (a) => a.createdAt >= bounds.start && a.createdAt < bounds.end
  ).length;

  return (
    <div className="admin-page">
      <Sidebar />
      <StatsBoard completed={completed} events={events} range={range} visits={visits} />
    </div>
  );
}
