import { supabase } from "./supabase";

export type WorkspaceStudent = {
  id: string;
  group_id: string;
  full_name: string;
  nickname: string | null;
  birth_place: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
  father_name: string | null;
  mother_name: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  school_grade: number | null;
  photo_path: string | null;
  show_photo: boolean;
  status: "active" | "inactive" | "archived";
};

export type WorkspaceClass = { id: string; group_id: string; name: string; description: string | null; is_active: boolean };
export type WorkspaceGroup = { id: string; village_id: string; name: string; study_days: number[]; reminder_time: string };
export type WorkspaceSchedule = { id: string; class_id: string; weekday: number; start_time: string; end_time: string; material_plan: string | null; is_active: boolean };
export type WorkspaceEnrollment = { id: string; class_id: string; student_id: string; ended_on: string | null };
export type WorkspaceTarget = { id: string; version_id: string; school_grade: number; code: string | null; title: string; description: string | null; target_value: number | null; target_unit: string | null; sort_order: number };
export type ChatThread = { id: string; title: string | null; group_id: string | null; created_at: string; is_announcement: boolean };
export type ChatMessage = { id: string; thread_id: string; sender_id: string | null; body: string; created_at: string };
export type WorkspaceArea = { id: string; name: string };
export type WorkspaceVillage = { id: string; area_id: string; name: string };
export type AccountRole = "super_admin" | "admin_daerah" | "admin_desa" | "pj_kelompok" | "pengajar";
export type WorkspaceAccount = {
  membership_id: string;
  user_id: string;
  role: AccountRole;
  area_id: string | null;
  village_id: string | null;
  group_id: string | null;
  is_active: boolean;
  username: string | null;
  full_name: string;
  last_login_at: string | null;
};
export type LoginActivity = { id: number; actor_id: string | null; action: string; entity_id: string | null; created_at: string };

export type WorkspaceData = {
  groups: WorkspaceGroup[];
  classes: WorkspaceClass[];
  students: WorkspaceStudent[];
  schedules: WorkspaceSchedule[];
  enrollments: WorkspaceEnrollment[];
  areas: WorkspaceArea[];
  villages: WorkspaceVillage[];
};

export const emptyWorkspace: WorkspaceData = { groups: [], classes: [], students: [], schedules: [], enrollments: [], areas: [], villages: [] };

export async function loadWorkspace(): Promise<WorkspaceData> {
  if (!supabase) return emptyWorkspace;
  const [areas, villages, groups, classes, students, schedules, enrollments] = await Promise.all([
    supabase.from("areas").select("id,name").order("name"),
    supabase.from("villages").select("id,area_id,name").order("name"),
    supabase.from("groups").select("id,village_id,name,study_days,reminder_time").order("name"),
    supabase.from("classes").select("id,group_id,name,description,is_active").order("name"),
    supabase.from("students").select("id,group_id,full_name,nickname,birth_place,birth_date,address,phone,father_name,mother_name,father_phone,mother_phone,school_grade,photo_path,show_photo,status").neq("status", "archived").order("full_name"),
    supabase.from("schedules").select("id,class_id,weekday,start_time,end_time,material_plan,is_active").eq("is_active", true).order("start_time"),
    supabase.from("class_enrollments").select("id,class_id,student_id,ended_on").is("ended_on", null),
  ]);
  const error = areas.error || villages.error || groups.error || classes.error || students.error || schedules.error || enrollments.error;
  if (error) throw error;
  return {
    groups: (groups.data ?? []) as WorkspaceGroup[],
    classes: (classes.data ?? []) as WorkspaceClass[],
    students: (students.data ?? []) as WorkspaceStudent[],
    schedules: (schedules.data ?? []) as WorkspaceSchedule[],
    enrollments: (enrollments.data ?? []) as WorkspaceEnrollment[],
    areas: (areas.data ?? []) as WorkspaceArea[],
    villages: (villages.data ?? []) as WorkspaceVillage[],
  };
}

export async function saveStudent(student: Partial<WorkspaceStudent> & Pick<WorkspaceStudent, "group_id" | "full_name">) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const payload = { ...student, updated_at: new Date().toISOString() };
  const query = student.id
    ? supabase.from("students").update(payload).eq("id", student.id)
    : supabase.from("students").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function setStudentStatus(id: string, status: "active" | "inactive" | "archived") {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const { error } = await supabase.from("students").update({
    status,
    deactivated_at: status === "active" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function saveAttendance(input: { classId: string; date: string; userId: string; records: Array<{ studentId: string; status: "hadir" | "izin" | "alpha" }> }) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const { data: session, error: sessionError } = await supabase.from("attendance_sessions").upsert({
    class_id: input.classId,
    session_date: input.date,
    submitted_by: input.userId,
    submitted_at: new Date().toISOString(),
  }, { onConflict: "class_id,session_date" }).select("id").single();
  if (sessionError) throw sessionError;
  const { error } = await supabase.from("attendance_records").upsert(input.records.map((record) => ({
    session_id: session.id,
    student_id: record.studentId,
    status: record.status,
    recorded_at: new Date().toISOString(),
  })), { onConflict: "session_id,student_id" });
  if (error) throw error;
}

export async function saveDailyJournal(input: { classId: string; userId: string; date: string; startedAt: string; endedAt: string; material: string; achievement?: string; obstacles?: string; improvementPlan?: string; notes?: string }) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const { data, error } = await supabase.from("daily_journals").upsert({
    class_id: input.classId,
    journal_date: input.date,
    responsible_user_id: input.userId,
    teacher_id: input.userId,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    material: input.material,
    achievement: input.achievement || null,
    obstacles: input.obstacles || null,
    improvement_plan: input.improvementPlan || null,
    notes: input.notes || null,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "class_id,journal_date" }).select("id").single();
  if (error) throw error;
  return data?.id ?? null;
}

export async function saveClass(input: { id?: string; groupId: string; name: string; description?: string }) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const payload = { group_id: input.groupId, name: input.name.trim(), description: input.description?.trim() || null, is_active: true, updated_at: new Date().toISOString() };
  const query = input.id ? supabase.from("classes").update(payload).eq("id", input.id) : supabase.from("classes").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function saveSchedule(input: { id?: string; classId: string; teacherId?: string; weekday: number; startTime: string; endTime: string; materialPlan?: string }) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const payload = { class_id: input.classId, teacher_id: input.teacherId || null, weekday: input.weekday, start_time: input.startTime, end_time: input.endTime, material_plan: input.materialPlan?.trim() || null, is_active: true, updated_at: new Date().toISOString() };
  const query = input.id ? supabase.from("schedules").update(payload).eq("id", input.id) : supabase.from("schedules").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteSchedule(id: string) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const { error } = await supabase.from("schedules").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function loadTargets() {
  if (!supabase) return [] as WorkspaceTarget[];
  const { data, error } = await supabase.from("targets").select("id,version_id,school_grade,code,title,description,target_value,target_unit,sort_order").order("school_grade").order("sort_order");
  if (error) throw error;
  return (data ?? []) as WorkspaceTarget[];
}

export async function saveTarget(input: { id?: string; areaId: string; createdBy: string; schoolGrade: number; title: string; description?: string; targetValue?: number; targetUnit?: string }) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  let versionId = input.id ? undefined : undefined;
  if (!versionId) {
    const { data: version } = await supabase.from("target_versions").select("id").eq("area_id", input.areaId).eq("title", "Target Pembelajaran").order("version", { ascending: false }).limit(1).maybeSingle();
    versionId = version?.id;
  }
  if (!versionId) {
    const { data: version, error } = await supabase.from("target_versions").insert({ area_id: input.areaId, title: "Target Pembelajaran", period_start: new Date().toISOString().slice(0, 10), period_end: `${new Date().getFullYear()}-12-31`, version: 1, published_at: new Date().toISOString(), created_by: input.createdBy }).select("id").single();
    if (error) throw error;
    versionId = version.id;
  }
  const payload = { version_id: versionId, school_grade: input.schoolGrade, title: input.title.trim(), description: input.description?.trim() || null, target_value: input.targetValue ?? null, target_unit: input.targetUnit?.trim() || null };
  const query = input.id ? supabase.from("targets").update(payload).eq("id", input.id) : supabase.from("targets").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteTarget(id: string) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const { error } = await supabase.from("targets").delete().eq("id", id);
  if (error) throw error;
}

export async function loadAttendanceSummary() {
  if (!supabase) return [] as Array<{ student_id: string; status: "hadir" | "izin" | "alpha"; session_date: string; class_id: string }>;
  const { data, error } = await supabase.from("attendance_records").select("student_id,status,attendance_sessions!inner(session_date,class_id)").order("recorded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ student_id: row.student_id, status: row.status, session_date: (row.attendance_sessions as unknown as { session_date: string }).session_date, class_id: (row.attendance_sessions as unknown as { class_id: string }).class_id }));
}

export async function loadChat() {
  if (!supabase) return { threads: [] as ChatThread[], messages: [] as ChatMessage[] };
  const [threads, messages] = await Promise.all([
    supabase.from("chat_threads").select("id,title,group_id,created_at,is_announcement").order("created_at", { ascending: false }),
    supabase.from("chat_messages").select("id,thread_id,sender_id,body,created_at").is("deleted_at", null).order("created_at", { ascending: true }),
  ]);
  if (threads.error) throw threads.error;
  if (messages.error) throw messages.error;
  return { threads: (threads.data ?? []) as ChatThread[], messages: (messages.data ?? []) as ChatMessage[] };
}

export async function createChatThread(input: { title: string; groupId: string; userId: string }) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const { data: thread, error } = await supabase.from("chat_threads").insert({ title: input.title.trim(), group_id: input.groupId, created_by: input.userId }).select("id").single();
  if (error) throw error;
  const { error: participantError } = await supabase.from("chat_participants").insert({ thread_id: thread.id, user_id: input.userId });
  if (participantError) { await supabase.from("chat_threads").delete().eq("id", thread.id); throw participantError; }
  return thread.id as string;
}

export async function sendChatMessage(input: { threadId: string; userId: string; body: string }) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const { error } = await supabase.from("chat_messages").insert({ thread_id: input.threadId, sender_id: input.userId, body: input.body.trim() });
  if (error) throw error;
}

export async function loadAccounts() {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const [memberships, profiles, activity] = await Promise.all([
    supabase.from("memberships").select("id,user_id,role,area_id,village_id,group_id,is_active").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,username,full_name,last_login_at,is_active"),
    supabase.from("audit_logs").select("id,actor_id,action,entity_id,created_at").in("action", ["user_login", "user_created", "user_updated", "user_activated", "user_deactivated", "user_deleted"]).order("created_at", { ascending: false }).limit(50),
  ]);
  const error = memberships.error || profiles.error;
  if (error) throw error;
  const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
  const accounts = (memberships.data ?? []).map((membership) => {
    const profile = profileById.get(membership.user_id);
    return {
      membership_id: membership.id,
      user_id: membership.user_id,
      role: membership.role,
      area_id: membership.area_id,
      village_id: membership.village_id,
      group_id: membership.group_id,
      is_active: Boolean(membership.is_active && profile?.is_active),
      username: profile?.username ?? null,
      full_name: profile?.full_name ?? "Pengguna",
      last_login_at: profile?.last_login_at ?? null,
    } as WorkspaceAccount;
  });
  return { accounts, activity: (activity.data ?? []) as LoginActivity[] };
}

export async function manageAccount(payload: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase belum terhubung");
  const { data, error } = await supabase.functions.invoke("manage-users", { body: payload });
  if (error) {
    let message = (data as { error?: string } | null)?.error ?? error.message;
    const context = (error as unknown as { context?: Response }).context;
    if (context) {
      try { const details = await context.clone().json() as { error?: string }; message = details.error ?? message; }
      catch { /* Keep the original Functions error when the body is not JSON. */ }
    }
    throw new Error(message);
  }
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
  return data;
}
