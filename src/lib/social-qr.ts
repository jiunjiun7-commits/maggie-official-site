import QRCode from "qrcode";

export type SocialQr = {
  key: "line" | "instagram" | "facebook";
  label: string;
  url: string;
  svg: string;
};

async function toInlineSvg(url: string) {
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#10213d", light: "#00000000" }
  });
  // 拿掉 XML 宣告與寫死的寬高，改用 CSS 控制大小，並用 currentColor 之外的方式維持金黑配色。
  return svg.replace(/^<\?xml.*?\?>/, "").replace(/ width="\d+" height="\d+"/, "");
}

export async function buildSocialQrList(
  links: { line: string; instagram: string; facebook: string }
): Promise<SocialQr[]> {
  const entries: Array<{ key: SocialQr["key"]; label: string; url: string }> = [
    { key: "line", label: "LINE 諮詢", url: links.line },
    { key: "instagram", label: "Instagram", url: links.instagram },
    { key: "facebook", label: "粉絲專頁", url: links.facebook }
  ].filter((entry) => entry.url) as Array<{ key: SocialQr["key"]; label: string; url: string }>;

  return Promise.all(
    entries.map(async (entry) => ({ ...entry, svg: await toInlineSvg(entry.url) }))
  );
}
