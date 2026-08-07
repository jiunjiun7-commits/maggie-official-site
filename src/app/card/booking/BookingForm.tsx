"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { INTENTS, MEET_TYPES, URGENCIES, type OpenDay } from "@/lib/booking";
import { PROFILE } from "@/lib/profile";

type SubmissionResult = {
  id: string;
  slotLabel: string;
  previewFile: string | null;
  /** system = 已寫入預約系統；line = 系統暫時無法寫入，改由 LINE 送出 */
  via: "system" | "line";
};

export default function BookingForm() {
  const [days, setDays] = useState<OpenDay[]>([]);
  const [activeDate, setActiveDate] = useState("");
  const [slotIso, setSlotIso] = useState("");
  const [meetType, setMeetType] = useState("");
  const [intent, setIntent] = useState<string[]>([]);
  const [urgency, setUrgency] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmissionResult | null>(null);

  async function loadSlots() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/appointment/slots", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "無法讀取時段");
      const nextDays = Array.isArray(payload.days) ? payload.days : [];
      setDays(nextDays);
      setActiveDate((current) => current || nextDays[0]?.date || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "無法讀取時段");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSlots();
  }, []);

  const activeDay = useMemo(
    () => days.find((day) => day.date === activeDate),
    [activeDate, days]
  );

  function toggleIntent(key: string) {
    setIntent((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  /** 把表單內容整理成可直接貼進 LINE 的訊息 */
  function buildLineMessage(slotLabel: string) {
    const lines = [
      "Maggie 你好，我想預約諮詢：",
      "",
      `・希望時段：${slotLabel}`,
      `・見面方式：${MEET_TYPES.find((item) => item.key === meetType)?.label ?? meetType}`,
      `・諮詢需求：${intent
        .map((key) => INTENTS.find((item) => item.key === key)?.label ?? key)
        .join("、")}`,
      `・預計處理：${URGENCIES.find((item) => item.key === urgency)?.label ?? urgency}`,
      `・姓名：${name.trim()}`,
      `・電話：${phone.trim()}`,
      `・Email：${email.trim()}`,
      "",
      `補充：${note.trim()}`,
      "",
      "（來自官網線上預約）"
    ];
    return lines.join("\n");
  }

  async function copyToClipboard(text: string) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // 舊瀏覽器或非安全環境的退路
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!slotIso) return setError("請先選擇日期與時段。");
    if (!meetType) return setError("請選擇見面方式。");
    if (!name.trim() || !phone.trim() || !email.trim()) return setError("請填妥姓名、電話與 Email。");
    if (!intent.length) return setError("請至少選擇一個需求。");
    if (!urgency) return setError("請選擇預計處理時間。");
    if (!note.trim()) return setError("請簡單描述需求。");

    const slotLabel =
      activeDay?.slots.find((slot) => slot.iso === slotIso)?.label
        ? `${activeDay?.label} ${activeDay?.slots.find((slot) => slot.iso === slotIso)?.label}`
        : slotIso;

    setSubmitting(true);
    try {
      const response = await fetch("/api/appointment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotIso,
          meetType,
          intent,
          urgency,
          name,
          phone,
          email,
          note
        })
      });

      // 時段剛被別人訂走：這是真的要請客戶改選，不能用 LINE 蓋過去
      if (response.status === 409) {
        const payload = await response.json();
        setSlotIso("");
        await loadSlots();
        throw new Error(payload.error || "這個時段剛剛被預約，請重新選擇。");
      }

      if (response.ok) {
        const payload = await response.json();
        setResult({ ...payload, via: "system" });
        return;
      }

      // 其他錯誤（例如伺服器暫時無法寫入）不讓客戶白跑一趟，改由 LINE 送出
      throw new Error("FALLBACK_TO_LINE");
    } catch (caught) {
      const isConflict =
        caught instanceof Error && caught.message !== "FALLBACK_TO_LINE" && caught.message !== "Failed to fetch";
      if (isConflict) {
        setError(caught.message);
        setSubmitting(false);
        return;
      }

      // 走 LINE：先把整理好的訊息複製起來，再開啟 LINE 讓客戶貼上
      const message = buildLineMessage(slotLabel);
      try {
        await copyToClipboard(message);
      } catch {
        // 複製失敗不影響流程，客戶仍可在完成頁自行複製
      }
      window.open(PROFILE.social.line, "_blank", "noopener");
      setResult({ id: "", slotLabel, previewFile: null, via: "line" });
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const viaLine = result.via === "line";
    return (
      <main className="booking-shell">
        <div className="page-heading">
          <Link href="/card">回電子名片</Link>
          <h1>{viaLine ? "只差最後一步" : "預約完成"}</h1>
          <p>
            {viaLine
              ? "你的需求已整理好並複製起來，LINE 也已經開啟——直接貼上送出，Maggie 就會收到。"
              : "需求已送出。Maggie 會先看過你的狀況再與你聯繫，見面時就不用從頭問起。"}
          </p>
        </div>
        <div className="form-success">
          <strong>{viaLine ? "你選擇的時段：" : "已保留時段："}</strong>
          <br />
          {result.slotLabel}
        </div>
        {/* 這裡是客戶看到的畫面，所以只給客戶用得到的出口，不放後台連結 */}
        <div className="choice-row">
          <a className="button line-button" href={PROFILE.social.line} target="_blank" rel="noreferrer">
            {viaLine ? "重新開啟 LINE" : "順便加 LINE 保持聯絡"}
          </a>
          <Link className="button-secondary" href="/card">回電子名片</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="booking-shell">
      <div className="page-heading">
        <Link href="/card">回電子名片</Link>
        <h1>線上預約諮詢</h1>
        <p>選一個方便的時段，留下你想處理的問題，房仲會依需求先做準備。</p>
      </div>

      <form onSubmit={submit}>
        <section className="booking-section">
          <div className="section-heading">
            <span className="section-number">1</span>
            <h2>選擇時間</h2>
            <small>台灣時間</small>
          </div>
          {loading ? <div className="loading-line">正在整理可預約時段...</div> : null}
          {!loading && days.length === 0 ? <div className="loading-line">目前沒有可預約時段。</div> : null}
          {days.length ? (
            <>
              <div className="choice-row date-row">
                {days.map((day) => (
                  <button
                    className="choice"
                    data-active={activeDate === day.date}
                    key={day.date}
                    onClick={() => {
                      setActiveDate(day.date);
                      setSlotIso("");
                    }}
                    type="button"
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="slot-grid">
                {activeDay?.slots.map((slot) => (
                  <button
                    className="choice"
                    data-active={slotIso === slot.iso}
                    key={slot.iso}
                    onClick={() => setSlotIso(slot.iso)}
                    type="button"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="booking-section">
          <div className="section-heading">
            <span className="section-number">2</span>
            <h2>見面方式</h2>
          </div>
          <div className="meet-grid">
            {MEET_TYPES.map((option) => (
              <button
                className="meet-choice"
                data-active={meetType === option.key}
                key={option.key}
                onClick={() => setMeetType(option.key)}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="booking-section">
          <div className="section-heading">
            <span className="section-number">3</span>
            <h2>聯絡資料</h2>
          </div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="name">姓名</label>
              <input id="name" autoComplete="name" maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />
            </div>
            <div className="field">
              <label htmlFor="phone">電話</label>
              <input id="phone" autoComplete="tel" inputMode="tel" maxLength={20} onChange={(event) => setPhone(event.target.value)} value={phone} />
            </div>
            <div className="field full">
              <label htmlFor="email">Email</label>
              <input id="email" autoComplete="email" inputMode="email" maxLength={160} onChange={(event) => setEmail(event.target.value)} value={email} />
            </div>
          </div>
        </section>

        <section className="booking-section">
          <div className="section-heading">
            <span className="section-number">4</span>
            <h2>諮詢需求</h2>
          </div>
          <div className="field">
            <label>想處理什麼</label>
            <div className="choice-row">
              {INTENTS.map((option) => (
                <button
                  className="choice"
                  data-active={intent.includes(option.key)}
                  key={option.key}
                  onClick={() => toggleIntent(option.key)}
                  title={option.hint}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label>預計何時處理</label>
            <div className="choice-row">
              {URGENCIES.map((option) => (
                <button
                  className="choice"
                  data-active={urgency === option.key}
                  key={option.key}
                  onClick={() => setUrgency(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="note">需求說明</label>
            <textarea
              id="note"
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：預算 2,000 萬，想找美術館特區三房含雙車位，希望半年內換屋。"
              value={note}
            />
          </div>
        </section>

        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button className="button booking-submit" disabled={submitting} type="submit">
          {submitting ? "正在建立預約..." : "確認預約"}
        </button>
        <p className="privacy-note">你留下的資料僅用於這次諮詢聯繫，不會提供給第三方。</p>
      </form>
    </main>
  );
}
