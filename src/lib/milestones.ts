export type Milestone = {
  icon: string;
  date: string;
  company: string;
  title: string;
  description: string;
};

/**
 * 專業歷程時間軸。刻意寫成單純的陣列（不含任何邏輯），
 * 之後要換成從外部 JSON / CMS 讀取時，只需要換掉這個檔案的內容，
 * 不用動 MilestoneCard 元件。
 *
 * 新增一筆榮譽 = 在陣列最後加一個物件，就會自動出現在輪播裡。
 */
export const MILESTONES: Milestone[] = [
  {
    icon: "🏆",
    date: "112 年 7 月",
    company: "高雄信義房屋",
    title: "高雄區業績 TOP 1",
    description: "年度代表性業績，也是我職涯的重要起點。"
  },
  {
    icon: "⭐",
    date: "112 年 7 月",
    company: "高雄信義房屋",
    title: "明日之星",
    description: "肯定持續成長與服務表現。"
  },
  {
    icon: "🏆",
    date: "112 年 7 月",
    company: "高雄信義房屋",
    title: "高三區業績 TOP 1",
    description: "持續累積成交成果，深耕高雄市場。"
  },
  {
    icon: "🏅",
    date: "113 年",
    company: "信義房屋",
    title: "年度最佳服務楷模",
    description: "由服務品質與客戶回饋評選，代表成交只是開始，服務才是長久價值。"
  },
  {
    icon: "📈",
    date: "114 年",
    company: "永義房屋",
    title: "升任經理",
    description: "職涯的重要里程碑，也代表責任與專業的提升。"
  },
  {
    icon: "🥈",
    date: "115 年 3 月",
    company: "永義房屋｜農十六大千",
    title: "業績 TOP 2",
    description: "持續深耕美術館與農十六市場。"
  },
  {
    icon: "⭐",
    date: "115 年 6 月",
    company: "永義房屋｜農十六大千",
    title: "未來之星",
    description: "肯定持續成長與發展潛力。"
  },
  {
    icon: "🥈",
    date: "115 年 7 月",
    company: "永義房屋｜農十六大千",
    title: "業績 TOP 2",
    description: "持續累積成交成果，也累積更多客戶信任。"
  }
];
