"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InternalDeal, InternalDealSourceType } from "@/lib/internal-deal-store";
import { classifyDeal, type Community, type ProductCategory, type ProductCategoryRule } from "@/lib/market-radar-store";

const SOURCE_TYPE_LABEL: Record<InternalDealSourceType, string> = {
  internal_announcement: "公司內部公告",
  external_brand_intel: "外部品牌情報",
  other: "其他來源"
};

const MATCH_STATUS_LABEL: Record<InternalDeal["matchStatus"], string> = {
  unmatched: "尚未配對",
  candidate: "有候選待確認",
  matched: "已確認同一筆"
};

// 物件用途／物件型態下拉選單詞彙，跟 Supabase 裡 product_category_rules 的種子規則同一套，
// 這樣手動輸入時選出來的組合才查得到分類。
const MAIN_USE_OPTIONS = ["住宅", "店面", "辦公", "住辦", "住店", "車位", "工廠", "土地", "倉庫", "其他"];
const BUILDING_TYPE_OPTIONS = [
  "無電梯公寓", "華廈", "大樓", "樓中樓", "透天", "別墅",
  "一般套房", "商務套房", "學生套房", "農舍", "農業用", "其他用", "住宅用", "商業用",
  "賣場", "工業區", "標準", "臨時", "一般", "辦公", "預售屋", "其他", "無",
  "升降/平面", "坡道/機械", "升降/機械", "平移/機械"
];

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("zh-TW");
}

export default function InternalDealsBoard({
  initialDeals,
  categories,
  rules,
  communities
}: {
  initialDeals: InternalDeal[];
  categories: ProductCategory[];
  rules: ProductCategoryRule[];
  communities: Community[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [sourceType, setSourceType] = useState<InternalDealSourceType>("internal_announcement");
  const [transactionDate, setTransactionDate] = useState("");
  const [internalAnnouncedDate, setInternalAnnouncedDate] = useState("");
  const [infoReceivedDate, setInfoReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [communityNameInput, setCommunityNameInput] = useState("");
  const [mainUseInput, setMainUseInput] = useState("");
  const [buildingTypeInput, setBuildingTypeInput] = useState("");
  const [buildingAreaPing, setBuildingAreaPing] = useState("");
  const [landAreaPing, setLandAreaPing] = useState("");
  const [parkingRaw, setParkingRaw] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [dealBrand, setDealBrand] = useState("");
  const [dealBranch, setDealBranch] = useState("");
  const [infoSource, setInfoSource] = useState("");
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);

  const categoryLabelById = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories]);

  const classification = useMemo(
    () => classifyDeal(mainUseInput, buildingTypeInput, rules),
    [mainUseInput, buildingTypeInput, rules]
  );
  const classificationLabel = classification.categoryId
    ? categoryLabelById.get(classification.categoryId) ?? "（分類已刪除）"
    : classification.needsReview
      ? "需人工確認分類"
      : "—";

  const communityMatch = useMemo(() => {
    const trimmed = communityNameInput.trim();
    if (!trimmed) return null;
    return communities.find((c) => c.name === trimmed) ?? null;
  }, [communityNameInput, communities]);

  function resetForm() {
    setSourceType("internal_announcement");
    setTransactionDate("");
    setInternalAnnouncedDate("");
    setInfoReceivedDate(new Date().toISOString().slice(0, 10));
    setDistrict("");
    setAddress("");
    setCommunityNameInput("");
    setMainUseInput("");
    setBuildingTypeInput("");
    setBuildingAreaPing("");
    setLandAreaPing("");
    setParkingRaw("");
    setTotalPrice("");
    setUnitPrice("");
    setDealBrand("");
    setDealBranch("");
    setInfoSource("");
    setNote("");
    setVerified(false);
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/market-radar/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          transactionDate,
          internalAnnouncedDate,
          infoReceivedDate,
          district,
          address,
          communityNameInput,
          mainUseInput,
          buildingTypeInput,
          buildingAreaPing: buildingAreaPing === "" ? null : Number(buildingAreaPing),
          landAreaPing: landAreaPing === "" ? null : Number(landAreaPing),
          parkingRaw,
          totalPrice: totalPrice === "" ? null : Number(totalPrice),
          unitPrice: unitPrice === "" ? null : Number(unitPrice),
          dealBrand: dealBrand || null,
          dealBranch: dealBranch || null,
          infoSource: infoSource || null,
          verified,
          note
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "建立失敗");
      setDeals((prev) => [payload.deal, ...prev]);
      resetForm();
      setShowForm(false);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>公司內部成交情報</h1>
          <p>公司內部公告或其他管道取得、尚未出現在官方實價登錄的成交情報，跟官方資料是兩個獨立來源，不會混在一起。</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="button-secondary" href="/admin/market-radar/areas">
            區域管理
          </Link>
          <Link className="button-secondary" href="/admin/market-radar/communities">
            社區資料庫
          </Link>
          <button className="button" onClick={() => setShowForm((v) => !v)} type="button">
            {showForm ? "取消" : "＋ 新增內部成交"}
          </button>
        </div>
      </div>

      {showForm ? (
        <form className="radar-form" onSubmit={submitCreate}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="sourceType">情報來源類型</label>
              <select id="sourceType" onChange={(e) => setSourceType(e.target.value as InternalDealSourceType)} value={sourceType}>
                {(Object.keys(SOURCE_TYPE_LABEL) as InternalDealSourceType[]).map((type) => (
                  <option key={type} value={type}>
                    {SOURCE_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="transactionDate">簽約日（選填）</label>
              <input id="transactionDate" onChange={(e) => setTransactionDate(e.target.value)} type="date" value={transactionDate} />
            </div>
            <div className="field">
              <label htmlFor="internalAnnouncedDate">內部公告日（選填）</label>
              <input
                id="internalAnnouncedDate"
                onChange={(e) => setInternalAnnouncedDate(e.target.value)}
                type="date"
                value={internalAnnouncedDate}
              />
            </div>
            <div className="field">
              <label htmlFor="infoReceivedDate">我方取得情報日</label>
              <input id="infoReceivedDate" onChange={(e) => setInfoReceivedDate(e.target.value)} type="date" value={infoReceivedDate} />
            </div>
            <div className="field">
              <label htmlFor="district">行政區</label>
              <input id="district" onChange={(e) => setDistrict(e.target.value)} value={district} />
            </div>
            <div className="field">
              <label htmlFor="address">地址</label>
              <input id="address" onChange={(e) => setAddress(e.target.value)} value={address} />
            </div>
            <div className="field">
              <label htmlFor="communityNameInput">社區名稱</label>
              <input
                id="communityNameInput"
                list="community-suggestions"
                onChange={(e) => setCommunityNameInput(e.target.value)}
                value={communityNameInput}
              />
              <datalist id="community-suggestions">
                {communities.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
              {communityNameInput.trim() ? (
                <span className={`tag ${communityMatch ? "active-true" : "active-false"}`} style={{ marginTop: 6 }}>
                  {communityMatch ? `已比對到既有社區：${communityMatch.name}` : "未配對社區，將標記待確認（不會自動新增）"}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="mainUseInput">物件用途</label>
              <select id="mainUseInput" onChange={(e) => setMainUseInput(e.target.value)} value={mainUseInput}>
                <option value="">請選擇</option>
                {MAIN_USE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="buildingTypeInput">物件型態</label>
              <input
                id="buildingTypeInput"
                list="building-type-suggestions"
                onChange={(e) => setBuildingTypeInput(e.target.value)}
                value={buildingTypeInput}
              />
              <datalist id="building-type-suggestions">
                {BUILDING_TYPE_OPTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>成交行情分類（自動判斷）</label>
              <span className={`tag ${classification.needsReview ? "active-false" : "active-true"}`}>{classificationLabel}</span>
            </div>
            <div className="field">
              <label htmlFor="buildingAreaPing">建物坪數</label>
              <input id="buildingAreaPing" onChange={(e) => setBuildingAreaPing(e.target.value)} type="number" value={buildingAreaPing} />
            </div>
            <div className="field">
              <label htmlFor="landAreaPing">土地坪數</label>
              <input id="landAreaPing" onChange={(e) => setLandAreaPing(e.target.value)} type="number" value={landAreaPing} />
            </div>
            <div className="field">
              <label htmlFor="parkingRaw">車位</label>
              <input id="parkingRaw" onChange={(e) => setParkingRaw(e.target.value)} value={parkingRaw} />
            </div>
            <div className="field">
              <label htmlFor="totalPrice">成交總價</label>
              <input id="totalPrice" onChange={(e) => setTotalPrice(e.target.value)} type="number" value={totalPrice} />
            </div>
            <div className="field">
              <label htmlFor="unitPrice">成交單價</label>
              <input id="unitPrice" onChange={(e) => setUnitPrice(e.target.value)} type="number" value={unitPrice} />
            </div>
            <div className="field">
              <label htmlFor="dealBrand">成交品牌</label>
              <input id="dealBrand" onChange={(e) => setDealBrand(e.target.value)} value={dealBrand} />
            </div>
            <div className="field">
              <label htmlFor="dealBranch">成交門店</label>
              <input id="dealBranch" onChange={(e) => setDealBranch(e.target.value)} value={dealBranch} />
            </div>
            <div className="field">
              <label htmlFor="infoSource">情報來源說明</label>
              <input id="infoSource" onChange={(e) => setInfoSource(e.target.value)} placeholder="例如：內部群組回報" value={infoSource} />
            </div>
            <div className="field full">
              <label htmlFor="note">備註</label>
              <textarea id="note" onChange={(e) => setNote(e.target.value)} value={note} />
            </div>
            <div className="field">
              <label htmlFor="verified" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input checked={verified} id="verified" onChange={(e) => setVerified(e.target.checked)} type="checkbox" />
                是否人工確認（這筆資料本身正確無誤）
              </label>
            </div>
          </div>
          {message ? <div className="form-error">{message}</div> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "建立中..." : "建立內部成交情報"}
          </button>
        </form>
      ) : null}

      {deals.length ? (
        <div className="rule-list">
          {deals.map((deal) => (
            <div className="rule-row" key={deal.id}>
              <span>
                <span className="rule-row-type">{SOURCE_TYPE_LABEL[deal.sourceType]}</span>
                {deal.district ? `${deal.district}｜` : ""}
                {deal.address || deal.communityNameInput || "（未填地址）"}
                {" ・ "}
                {deal.categoryId ? categoryLabelById.get(deal.categoryId) ?? "—" : deal.needsReview ? "需人工確認分類" : "—"}
                {" ・ "}
                總價 {formatMoney(deal.totalPrice)}
                {" ・ "}
                <span className={`tag active-${deal.verified}`}>{deal.verified ? "已人工確認" : "未確認"}</span>
                {" "}
                <span className="tag active-true">{MATCH_STATUS_LABEL[deal.matchStatus]}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">目前還沒有任何內部成交情報，按上方「＋ 新增內部成交」開始。</div>
      )}
    </main>
  );
}
