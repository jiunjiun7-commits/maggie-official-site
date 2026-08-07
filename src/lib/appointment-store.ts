import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseClient } from "@/lib/supabase";

const DATA_DIR = path.join(process.cwd(), "data");
const DATABASE_FILE = path.join(DATA_DIR, "appointments.json");
const SEED_FILE = path.join(DATA_DIR, "appointments.seed.json");

export type AppointmentStatus = "confirmed" | "completed" | "cancelled";

export type Appointment = {
  id: string;
  name: string;
  phone: string;
  email: string;
  meetType: string;
  intent: string[];
  urgency: string | null;
  note: string;
  slotIso: string;
  status: AppointmentStatus;
  aiHeat: "high" | "mid" | "low";
  aiSuggestion: string;
  aiSummary: string;
  aiNextAction: string;
  previewFile: string | null;
  createdAt: string;
};

export class SlotConflictError extends Error {
  constructor() {
    super("這個時段剛剛被預約，請重新選擇。");
    this.name = "SlotConflictError";
  }
}

/* ==============================================================
   Supabase 的資料列用 snake_case，程式其他地方一律維持原本的
   camelCase，只在這個檔案的邊界做轉換。
   ============================================================== */

type AppointmentRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  meet_type: string;
  intent: string[];
  urgency: string | null;
  note: string;
  slot_iso: string;
  status: AppointmentStatus;
  ai_heat: "high" | "mid" | "low";
  ai_suggestion: string;
  ai_summary: string;
  ai_next_action: string;
  preview_file: string | null;
  created_at: string;
};

function fromRow(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    meetType: row.meet_type,
    intent: row.intent,
    urgency: row.urgency,
    note: row.note,
    slotIso: row.slot_iso,
    status: row.status,
    aiHeat: row.ai_heat,
    aiSuggestion: row.ai_suggestion,
    aiSummary: row.ai_summary,
    aiNextAction: row.ai_next_action,
    previewFile: row.preview_file,
    createdAt: row.created_at
  };
}

function toInsertRow(input: Omit<Appointment, "id" | "status" | "previewFile" | "createdAt">) {
  return {
    name: input.name,
    phone: input.phone,
    email: input.email,
    meet_type: input.meetType,
    intent: input.intent,
    urgency: input.urgency,
    note: input.note,
    slot_iso: input.slotIso,
    ai_heat: input.aiHeat,
    ai_suggestion: input.aiSuggestion,
    ai_summary: input.aiSummary,
    ai_next_action: input.aiNextAction
  };
}

/* ==============================================================
   本機檔案模式：只有在沒設定 Supabase 環境變數時使用（本機開發）。
   正式環境（Vercel）的檔案系統是唯讀的，這條路在那裡完全不能用，
   這也是先前線上預約全部失敗的原因。
   ============================================================== */

let writeQueue: Promise<unknown> = Promise.resolve();
function withLock<T>(operation: () => Promise<T>) {
  const run = writeQueue.then(operation, operation);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function readJsonFile(file: string): Promise<Appointment[]> {
  const raw = await fs.readFile(file, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as Appointment[]) : [];
}

async function readFileAppointments(): Promise<Appointment[]> {
  try {
    return await readJsonFile(DATABASE_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return readJsonFile(SEED_FILE);
  }
}

async function writeFileAppointments(rows: Appointment[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temporary = `${DATABASE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  await fs.rename(temporary, DATABASE_FILE);
}

/* ==============================================================
   對外函式：有設定 Supabase 環境變數就走資料庫，
   沒有就退回本機檔案——呼叫端（API routes、後台頁面）完全不用改。
   ============================================================== */

export async function readAppointments(): Promise<Appointment[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return readFileAppointments();

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as AppointmentRow[]).map(fromRow);
}

export async function bookedSlots() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const rows = await readFileAppointments();
    return new Set(rows.filter((row) => row.status === "confirmed").map((row) => row.slotIso));
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("slot_iso")
    .eq("status", "confirmed");
  if (error) throw error;
  return new Set((data as { slot_iso: string }[]).map((row) => row.slot_iso));
}

export async function listAppointments(status = "all") {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const rows = await readFileAppointments();
    const filtered = status === "all" ? rows : rows.filter((row) => row.status === status);
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  let query = supabase.from("appointments").select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as AppointmentRow[]).map(fromRow);
}

type CreateAppointmentInput = Omit<Appointment, "id" | "status" | "previewFile" | "createdAt">;

export async function createAppointment(input: CreateAppointmentInput) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return withLock(async () => {
      const rows = await readFileAppointments();
      if (rows.some((row) => row.status === "confirmed" && row.slotIso === input.slotIso)) {
        throw new SlotConflictError();
      }
      const appointment: Appointment = {
        ...input,
        id: crypto.randomUUID(),
        status: "confirmed",
        previewFile: null,
        createdAt: new Date().toISOString()
      };
      rows.push(appointment);
      await writeFileAppointments(rows);
      return appointment;
    });
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...toInsertRow(input), status: "confirmed" })
    .select()
    .single();

  if (error) {
    // Postgres 23505 = unique_violation：資料庫的唯一索引擋下了撞號，
    // 這一步就是 schema.sql 裡那個 partial unique index 在發揮作用。
    if (error.code === "23505") throw new SlotConflictError();
    throw error;
  }
  return fromRow(data as AppointmentRow);
}

export async function attachPreview(id: string, previewFile: string | null) {
  if (!previewFile) return;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return withLock(async () => {
      const rows = await readFileAppointments();
      const appointment = rows.find((row) => row.id === id);
      if (!appointment) return;
      appointment.previewFile = previewFile;
      await writeFileAppointments(rows);
    });
  }

  const { error } = await supabase
    .from("appointments")
    .update({ preview_file: previewFile })
    .eq("id", id);
  if (error) throw error;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return withLock(async () => {
      const rows = await readFileAppointments();
      const appointment = rows.find((row) => row.id === id);
      if (!appointment) return null;
      appointment.status = status;
      await writeFileAppointments(rows);
      return appointment;
    });
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as AppointmentRow) : null;
}

export async function resetDemoAppointments() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return withLock(async () => {
      try {
        await fs.unlink(DATABASE_FILE);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    });
  }

  // 清空整張表，再塞回 seed 檔案裡的示範資料，跟本機檔案模式的行為一致
  const { error: deleteError } = await supabase
    .from("appointments")
    .delete()
    .not("id", "is", null);
  if (deleteError) throw deleteError;

  const seedRaw = await fs.readFile(SEED_FILE, "utf8");
  const seedRows = JSON.parse(seedRaw) as Appointment[];
  const { error: insertError } = await supabase.from("appointments").insert(
    seedRows.map((row) => ({
      ...toInsertRow(row),
      status: row.status,
      created_at: row.createdAt
    }))
  );
  if (insertError) throw insertError;
}
