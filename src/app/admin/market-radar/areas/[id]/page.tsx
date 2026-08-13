import { notFound } from "next/navigation";
import Topbar from "@/app/_components/Topbar";
import { getArea, listAreaRules } from "@/lib/market-radar-store";
import AreaDetailBoard from "./AreaDetailBoard";
import "../../../login/login.css";
import "../../market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarAreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const area = await getArea(id);
  if (!area) notFound();
  const rules = await listAreaRules(id);

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <AreaDetailBoard initialArea={area} initialRules={rules} />
    </div>
  );
}
