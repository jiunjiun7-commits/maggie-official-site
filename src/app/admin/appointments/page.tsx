import Topbar from "@/app/_components/Topbar";
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
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <AppointmentBoard initialRows={rows} status={status} />
    </div>
  );
}
