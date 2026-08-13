import Sidebar from "@/app/admin/_components/Sidebar";
import { listAppointments } from "@/lib/appointment-store";
import AppointmentBoard from "./AppointmentBoard";
import "../login/login.css";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = ["confirmed", "completed", "cancelled"].includes(params.status || "")
    ? params.status!
    : "all";
  const rows = await listAppointments(status);

  return (
    <div className="admin-page">
      <Sidebar />
      <AppointmentBoard initialRows={rows} status={status} />
    </div>
  );
}
