import crypto from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

const BUCKET = "seller-report-photos";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 原始檔上限，壓縮前檢查
const MAX_WIDTH = 1600;

/**
 * 上傳一張「本週推廣紀錄」照片。不綁在特定週報 id 上——新增週報時報告本身還沒存在，
 * 表單先把照片上傳到 Storage 拿網址，送出整份週報時才把網址存進 seller_reports.promotion_photos，
 * 跟「競品」那個 jsonb 陣列欄位是同一種先在瀏覽器端組資料、送出時一起存的模式。
 *
 * 這支路由掛在 /api/sellers/[id]/* 底下，沿用 src/middleware.ts 既有的 matcher 保護，
 * 不用額外加驗證；[id] 只用來當 Storage 路徑的資料夾名稱，方便之後追查/清理。
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "尚未設定 Supabase，無法上傳照片。" }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "沒有收到檔案。" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "只支援 JPEG、PNG、WEBP 格式的圖片。" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "檔案太大，單張圖片請控制在 8MB 以內。" }, { status: 400 });
  }

  try {
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    // 手機拍的原圖常常好幾 MB，上傳前先縮到最長邊 1600px、轉成 JPEG，
    // 避免屋主用手機看 Portal 時載入太慢。
    const compressed = await sharp(rawBuffer)
      .rotate() // 依照片本身的 EXIF 方向自動轉正，避免直向照片變橫的
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // 檔名用隨機 UUID，不含案件名稱／屋主姓名／地址；資料夾用 seller id（本身也是 uuid，不是可讀名稱）分類。
    const path = `${id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, error: caught instanceof Error ? caught.message : "上傳失敗" },
      { status: 500 }
    );
  }
}
