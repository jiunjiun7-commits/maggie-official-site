import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 課堂上常直接開 127.0.0.1；允許本機開發資源，不放寬外部網域。
  allowedDevOrigins: ["127.0.0.1"],
  // sharp 是原生模組（含平台專屬的 .node/.so 檔），交給 Next 打包會在 Vercel 的
  // serverless runtime 上找不到 libvips 共用函式庫（ERR_DLOPEN_FAILED）。
  // 列成 external 後改用一般 require 載入，npm install 當下裝好的 linux-x64 版本就能正常運作。
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
