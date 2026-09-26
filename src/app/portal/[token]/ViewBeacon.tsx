"use client";

import { useEffect } from "react";

/**
 * 屋主真的用瀏覽器打開週報時回報一次，讓後台的「已開啟」燈號有依據。
 *
 * 畫面上完全看不到這個元件，也不會影響頁面內容——回報失敗就算了，
 * 不能因為統計沒記到就讓屋主看不到週報。
 */
export default function ViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    fetch(`/api/portal/${encodeURIComponent(token)}/view`, {
      method: "POST",
      keepalive: true
    }).catch(() => {
      /* 記錄失敗不影響閱讀，安靜忽略 */
    });
  }, [token]);

  return null;
}
