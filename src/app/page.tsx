import Image from "next/image";
import Link from "next/link";
import CountUp from "@/app/_components/CountUp";
import SiteInteractions from "@/app/_components/SiteInteractions";
import { BRAND, PROFILE } from "@/lib/profile";
import "./site.css";

/**
 * 累積成交實績。⚠️ 這是對外公開的業績數字，更新前請先自己核對。
 * 實際金額 2.59632 億，顯示取到小數第二位。
 */
const TOTAL_SALES_100M = 2.6;
const TOTAL_DEALS = 24;

const LINE_URL = PROFILE.social.line;
const TEL_URL = `tel:${PROFILE.phoneRaw}`;

const AREAS = [
  {
    name: "鼓山區",
    text: "美術館特區、內惟、龍華、鼓山高中一帶。高綠覆、學區完整，是高雄自住兼保值的長青選擇。"
  },
  {
    name: "左營區",
    text: "農十六、巨蛋、新光路廊、高鐵左營站生活圈。交通與商圈成熟，換屋與置產族群的主戰場。"
  },
  {
    name: "三民區",
    text: "民族路、九如路、澄清湖周邊。生活機能密度高、總價帶完整，首購與收租都找得到題材。"
  }
];

const SERVICES = [
  {
    no: "01",
    title: "高級住宅",
    body: "美術館特區、農十六等高總價住宅的買賣。含社區條件比對、公設與車位分析、屋況與管理品質查核、開價策略與議價節奏規劃。",
    ticks: ["社區條件、公設與車位逐項比對", "買方需求分析與看屋動線安排", "議價節奏與成交條件談判"]
  },
  {
    no: "02",
    title: "資產配置",
    body: "先確認目的，再談標的。自住、換屋、置產、收租，四種目的該買的物件完全不同，我會協助你把資金、貸款成數與持有成本一起算進來。",
    ticks: ["自住 / 置產 / 收租的目標釐清", "貸款成數、月付與現金流試算", "進場與出場時機的風險提醒"]
  },
  {
    no: "03",
    title: "稅務諮詢",
    body: "房地合一稅、土地增值稅、自用住宅優惠、重購退稅、贈與與繼承。這些在開價之前就該算清楚，不是等到簽約才發現數字不對。",
    ticks: ["持有年限與稅率的事前試算", "重購退稅與自用優惠適用判斷", "複雜案件協同地政士、會計師處理"]
  },
  {
    no: "04",
    title: "市場行情分析諮詢",
    body: "「這個價格到底合不合理？」這是買方賣方都會問的第一句話。我會把實價登錄、同社區近期成交、目前在售物件與待售量一起攤開，讓你看到的不是一個數字，是這個數字怎麼來的。",
    ticks: ["實價登錄與同社區成交比對", "指定社區、路段的行情走勢追蹤", "買方出價與賣方開價的合理區間評估"]
  }
];

const FLOW = [
  "線上預約或 LINE 說明需求",
  "需求釐清與稅務／預算試算",
  "物件篩選與現場帶看",
  "議價、簽約、用印完稅",
  "驗屋交屋與後續服務"
];

const TICKER = [
  "美術館特區", "農十六重劃區", "鼓山區", "左營區", "三民區",
  "高級住宅", "資產配置", "稅務諮詢", "行情分析"
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: BRAND.siteName,
  alternateName: "房地產護理師 Maggie",
  description:
    "高雄房地產經紀人，專營美術館特區與農十六，服務鼓山區、左營區、三民區。提供高級住宅、資產配置、稅務諮詢與市場行情分析。",
  image: "/site/img/profile.jpg",
  telephone: "+886-958-563-377",
  priceRange: "$$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: "高雄市",
    addressRegion: "左營區",
    addressCountry: "TW"
  },
  areaServed: ["高雄市鼓山區", "高雄市左營區", "高雄市三民區", "美術館特區", "農十六重劃區"].map(
    (name) => ({ "@type": "Place", name })
  ),
  employee: {
    "@type": "Person",
    name: "林俞君",
    alternateName: "Maggie",
    jobTitle: "經理｜不動產經紀人",
    worksFor: { "@type": "Organization", name: "永義房屋" },
    telephone: "+886-958-563-377",
    award: ["112 年度 TOP1", "年度最佳服務楷模"]
  },
  makesOffer: SERVICES.map((s) => ({
    "@type": "Offer",
    itemOffered: { "@type": "Service", name: s.title, description: s.body }
  }))
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <SiteInteractions />

      <a className="skip" href="#main">跳到主要內容</a>

      {/* ===== 導覽列 ===== */}
      <header className="nav" id="nav">
        <div className="wrap nav__inner">
          <a className="nav__brand" href="#top">
            <span className="nav__mark" aria-hidden="true">M</span>
            <span className="nav__name">林俞君 <em>Maggie</em></span>
          </a>
          <nav className="nav__links" aria-label="主選單">
            <a href="#about">關於我</a>
            <a href="#area">服務區域</a>
            <a href="#record">戰績</a>
            <a href="#service">服務項目</a>
            <a href="#booking">預約諮詢</a>
          </nav>
          <Link className="btn btn--line nav__cta" href="/card/booking">線上預約</Link>
          <button className="nav__burger" id="burger" aria-label="開啟選單" aria-expanded="false" aria-controls="nav">
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main id="main">

        {/* ===== 1. 形象照 / Hero ===== */}
        <section className="hero" id="top">
          <div className="wrap hero__inner">
            <div className="hero__text">
              <p className="eyebrow">高雄市 鼓山‧左營‧三民｜專營美術館 ‧ 農十六</p>
              <h1>房子沒有好壞，<br />只有<span className="hl">適不適合</span>你。</h1>
              <p className="lede">
                我是<strong>林俞君 Maggie</strong>，永義房屋經理。護理出身，習慣先聽懂你的處境，
                再談房子——把需求、預算、稅務與風險一次攤開講清楚，讓你在簽名之前就已經安心。
              </p>

              <ul className="hero__badges">
                <li><span>112 年度</span>TOP 1</li>
                <li><span>年度</span>最佳服務楷模</li>
                <li><span>專營</span>美術館‧農十六</li>
              </ul>

              <div className="hero__cta">
                <Link className="btn btn--line" href="/card/booking">線上預約諮詢</Link>
                <a className="btn btn--ghost" href={TEL_URL}>撥打 {PROFILE.phone}</a>
              </div>
            </div>

            <figure className="hero__photo">
              <Image
                src="/site/img/profile.jpg"
                alt="高雄房地產經紀人林俞君 Maggie 形象照，永義房屋經理，服務高雄鼓山、左營、三民區"
                width={1291}
                height={1900}
                priority
              />
              <figcaption>林俞君 Maggie｜永義房屋 經理</figcaption>
            </figure>
          </div>

          <div className="hero__ticker" aria-hidden="true">
            <div className="ticker__track">
              {[...TICKER, ...TICKER].map((word, i) => (
                <span key={`${word}-${i}`}>{word}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 關於我 ===== */}
        <section className="section section--soft" id="about">
          <div className="wrap grid-2 grid-2--about">
            <div>
              <p className="eyebrow">About</p>
              <h2>從護理站到交屋現場，<br />我做的其實是同一件事</h2>
              <figure className="side-photo">
                <Image
                  src="/site/img/about.jpg"
                  alt="林俞君 Maggie 與客戶餐敘，高雄房地產顧問"
                  width={1440}
                  height={1441}
                />
              </figure>
            </div>
            <div className="prose">
              <p>
                在成為房仲之前，我在醫院待了近五年——心臟內外科、新生兒加護、血液腫瘤與安寧緩和。
                那幾年教會我的是：<strong>面對重大決定的人，最需要的不是話術，是把事情講清楚的人。</strong>
              </p>
              <p>
                買房賣房也是一樣。金額大、流程長、每一步都有看不見的風險。
                所以我的做法很固定：先釐清你真正的需求，再盤點預算與貸款、試算稅務、說明每個階段會發生什麼，
                最後才帶你看房。你不需要懂全部，但你有權利知道全部。
              </p>
              <p>
                目前服務高雄市<strong>鼓山區、左營區、三民區</strong>，專營<strong>美術館特區與農十六重劃區</strong>的高總價住宅。
              </p>
            </div>
          </div>
        </section>

        {/* ===== 2. 服務區域 ===== */}
        <section className="section" id="area">
          <div className="wrap">
            <p className="eyebrow">Service Area</p>
            <h2 className="section__title">我服務的區塊</h2>
            <p className="section__sub">
              深耕高雄市區三個行政區。不是「哪裡有案就接哪裡」，而是把幾個區域走到熟——
              熟到我可以直接告訴你這條路的車聲、這個學區的實際狀況、這棟社區的管理費合不合理。
            </p>

            <div className="cards cards--3">
              {AREAS.map((area) => (
                <article className="card card--area" key={area.name}>
                  <h3>{area.name}</h3>
                  <p className="card__tag">核心服務區</p>
                  <p>{area.text}</p>
                </article>
              ))}
            </div>

            <div className="focus">
              <div className="focus__label">專營重點</div>
              <div className="focus__body">
                <h3>美術館特區 ‧ 農十六重劃區</h3>
                <p>
                  這兩個區域是我投入最深的地方。從各社區的規劃、公設比、管理品質、車位配置，
                  到近期成交行情與屋主釋出狀況，都持續在追蹤。
                  不論你是要<strong>買進</strong>、<strong>換屋</strong>還是<strong>評估手上物件價值</strong>，都可以直接問我。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 3. 戰績 ===== */}
        <section className="section section--dark" id="record">
          <div className="wrap">
            <p className="eyebrow eyebrow--light">Track Record</p>
            <h2 className="section__title">我的戰績</h2>
            <p className="section__sub section__sub--light">
              數字不是拿來炫耀的，是拿來證明「這套做法真的有效」。
            </p>

            {/* 成交實績：捲到畫面內才開始跑動 */}
            <div className="bigstat">
              <div className="bigstat__grid">
                <div className="bigstat__item">
                  <div className="bigstat__label">累積成交總額</div>
                  <div className="bigstat__num">
                    <span className="bigstat__unit">NT$</span>
                    <CountUp to={TOTAL_SALES_100M} decimals={2} />
                    <em>億</em>
                  </div>
                </div>
                <div className="bigstat__item">
                  <div className="bigstat__label">累積成交件數</div>
                  <div className="bigstat__num">
                    <CountUp to={TOTAL_DEALS} />
                    <em>件</em>
                  </div>
                </div>
              </div>
              <p className="bigstat__note">
                2023 年入行至今，累積成交 {TOTAL_DEALS} 件、總額約新台幣 {TOTAL_SALES_100M} 億元。
                不是靠一兩件大案衝出來的數字，是一件一件把風險講清楚換來的。
              </p>
            </div>

            <div className="stats stats--2">
              <div className="stat">
                <div className="stat__num">TOP <em>1</em></div>
                <div className="stat__label">112 年度全公司第一</div>
                <p>以年度業績表現獲頒 TOP 1，肯定在美術館與農十六的深耕成果。</p>
              </div>
              <div className="stat">
                <div className="stat__num">最佳服務<em>楷模</em></div>
                <div className="stat__label">年度最佳服務楷模</div>
                <p>由服務品質與客戶回饋評選，代表的不只是成交，是成交之後客戶還願意介紹朋友來。</p>
              </div>
            </div>

            <div className="award">
              <figure className="award__photo">
                <Image
                  src="/site/img/award.jpg"
                  alt="林俞君 Maggie 獲頒永義房屋正陽團隊結訓證書，高雄房仲"
                  width={1080}
                  height={1440}
                />
              </figure>
              <blockquote className="quote">
                「Maggie 會把最壞的情況先講給你聽。一開始覺得她很敢講，成交之後才發現，
                那些提醒每一條都用得上。」
                <cite>— 美術館特區 換屋客戶</cite>
              </blockquote>
            </div>
          </div>
        </section>

        {/* ===== 4. 服務項目 ===== */}
        <section className="section" id="service">
          <div className="wrap">
            <p className="eyebrow">Services</p>
            <h2 className="section__title">我提供的服務項目</h2>
            <p className="section__sub">
              不是「幫你找房子」四個字就結束。從你還在猶豫要不要買，到鑰匙交到你手上，中間每一段我都在。
            </p>

            <div className="cards cards--2">
              {SERVICES.map((service) => (
                <article className="card card--svc" key={service.no}>
                  <span className="card__no">{service.no}</span>
                  <h3>{service.title}</h3>
                  <p>{service.body}</p>
                  <ul className="ticks">
                    {service.ticks.map((tick) => <li key={tick}>{tick}</li>)}
                  </ul>
                </article>
              ))}
            </div>

            <div className="flow">
              <h3 className="flow__title">合作流程</h3>
              <ol className="flow__list">
                {FLOW.map((step, i) => (
                  <li key={step}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ===== 5. 預約系統入口 ===== */}
        <section className="section section--book" id="booking">
          <div className="wrap grid-2 grid-2--book">
            <div className="book__intro">
              <p className="eyebrow">Booking</p>
              <h2>預約諮詢</h2>
              <p className="lede">
                直接在線上挑一個你方便的時段，留下想處理的問題。
                送出後我會先看過你的需求再回覆，見面時就不用從頭問起。
              </p>

              <ul className="contact">
                <li>
                  <span className="contact__k">LINE ID</span>
                  <a className="contact__v" href={LINE_URL} target="_blank" rel="noreferrer">
                    {BRAND.lineId}
                  </a>
                </li>
                <li>
                  <span className="contact__k">手機</span>
                  <a className="contact__v" href={TEL_URL}>{PROFILE.phone}</a>
                </li>
                <li>
                  <span className="contact__k">服務區域</span>
                  <span className="contact__v">{BRAND.areas}</span>
                </li>
              </ul>

              <div className="book__quick">
                <a className="btn btn--ghost btn--lg" href={LINE_URL} target="_blank" rel="noreferrer">
                  先用 LINE 問問看
                </a>
                <a className="btn btn--ghost btn--lg" href={TEL_URL}>直接撥電話</a>
              </div>
            </div>

            <div className="book__panel">
              <h3>線上預約一對一諮詢</h3>
              <ol className="book__steps">
                <li><b>選時段</b>平日 10:00–18:00，可預約兩週內</li>
                <li><b>選方式</b>門市面談、電話聯繫或線上視訊</li>
                <li><b>填需求</b>買房、賣房、資產配置、稅務或行情</li>
              </ol>
              <p className="book__note">
                同一個時段只會有一位客戶，送出後系統會立刻確認時段並鎖定。
              </p>
              <Link className="btn btn--line btn--lg btn--block" href="/card/booking">
                開始預約
              </Link>
              <Link className="book__cardlink" href="/card">或先看我的電子名片 →</Link>
            </div>
          </div>
        </section>

      </main>

      {/* ===== Footer ===== */}
      <footer className="foot">
        <div className="wrap foot__inner">
          <div className="foot__brand">
            <span className="nav__mark" aria-hidden="true">M</span>
            <div>
              <strong>林俞君 Maggie</strong>
              <span>永義房屋｜經理</span>
            </div>
          </div>
          <nav className="foot__links" aria-label="頁尾選單">
            <a href="#about">關於我</a>
            <a href="#area">服務區域</a>
            <a href="#record">戰績</a>
            <a href="#service">服務項目</a>
            <Link href="/card/booking">線上預約</Link>
            <Link href="/card">電子名片</Link>
          </nav>
          <div className="foot__contact">
            <a href={TEL_URL}>{PROFILE.phone}</a>
            <a href={LINE_URL} target="_blank" rel="noreferrer">LINE：{BRAND.lineId}</a>
          </div>
        </div>
        <div className="wrap foot__legal">
          <p>
            本網站資訊僅供參考，實際條件、價格與稅務結果以現場查證及主管機關核定為準。
            委託前請確認經紀業與經紀人證照資訊。
          </p>
          <p>&copy; {new Date().getFullYear()} 林俞君 Maggie．高雄房地產顧問</p>
        </div>
      </footer>

      {/* 手機浮動 CTA */}
      <div className="fab" aria-label="快速聯絡">
        <Link className="fab__btn fab__btn--line" href="/card/booking">線上預約</Link>
        <a className="fab__btn fab__btn--tel" href={TEL_URL}>撥電話</a>
      </div>
    </>
  );
}
