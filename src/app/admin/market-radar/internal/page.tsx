import Topbar from "@/app/_components/Topbar";
import { listInternalDeals } from "@/lib/internal-deal-store";
import { listCommunities, listProductCategories, listProductCategoryRules } from "@/lib/market-radar-store";
import InternalDealsBoard from "./InternalDealsBoard";
import "../../login/login.css";
import "../market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarInternalPage() {
  const [deals, categories, rules, communities] = await Promise.all([
    listInternalDeals(),
    listProductCategories(),
    listProductCategoryRules(),
    listCommunities()
  ]);

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <InternalDealsBoard
        categories={categories}
        communities={communities}
        initialDeals={deals}
        rules={rules}
      />
    </div>
  );
}
