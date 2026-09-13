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
  const { error } = await supabase.from("daily_journals").upsert({
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
  }, { onConflict: "class_id,journal_date" });
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
  if (error) throw new Error((data as { error?: string } | null)?.error ?? error.message);
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
  return data;
}
