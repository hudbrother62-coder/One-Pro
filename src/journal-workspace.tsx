import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardText, Sparkle, Student, Target, Users } from "@phosphor-icons/react";
import { supabase } from "./lib/supabase";
import type { WorkspaceAccount, WorkspaceData, WorkspaceTarget } from "./lib/data";
import { KeyboardInput, KeyboardTextarea } from "./mobile";
import "./journal-workspace.css";

type Role = "Pengajar" | "PJ Kelompok" | "Admin Desa" | "Admin Daerah" | "Super Admin";
type JournalMode = "class" | "individual";
type ScoreKey = "material_completion" | "class_engagement" | "general_understanding" | "discipline";
type StudentScoreKey = "target_progress" | "understanding" | "practice" | "independence" | "participation";

type AssessmentDraft = {
  targetId: string;
  stage: "mulai" | "berkembang" | "perlu_penguatan" | "tercapai";
  note: string;
  followUp: string;
  scores: Record<StudentScoreKey, number>;
};

type AiAnalysis = {
  summary?: string;
  strengths?: string[];
  attention?: string[];
  students_needing_support?: Array<{ student_id?: string; name?: string; reason?: string; next_action?: string }>;
  class_recommendations?: string[];
  next_month_focus?: string[];
  data_quality?: { status?: string; notes?: string[] };
  rubric_version?: string;
};

const RUBRIC_VERSION = "one-pro-journal-v1";
const scoreOptions = [1, 2, 3, 4];
const stageToValue: Record<AssessmentDraft["stage"], number> = { mulai: 25, berkembang: 50, perlu_penguatan: 60, tercapai: 100 };
const stageLabel: Record<AssessmentDraft["stage"], string> = { mulai: "Mulai", berkembang: "Berkembang", perlu_penguatan: "Perlu penguatan", tercapai: "Tercapai" };
const classRubric: Array<{ key: ScoreKey; label: string; hint: string }> = [
  { key: "material_completion", label: "Keterlaksanaan materi", hint: "Seberapa sesuai pelaksanaan dengan rencana materi hari ini." },
  { key: "class_engagement", label: "Keaktifan kelas", hint: "Partisipasi dan keterlibatan anak selama pengajian." },
  { key: "general_understanding", label: "Pemahaman umum", hint: "Gambaran pemahaman kelas terhadap materi yang disampaikan." },
  { key: "discipline", label: "Adab & kedisiplinan", hint: "Ketertiban, adab, dan kesiapan mengikuti pengajian." },
];
const studentRubric: Array<{ key: StudentScoreKey; label: string }> = [
  { key: "target_progress", label: "Kemajuan target" },
  { key: "understanding", label: "Pemahaman" },
  { key: "practice", label: "Praktik / keterampilan" },
  { key: "independence", label: "Kemandirian" },
  { key: "participation", label: "Adab / partisipasi" },
];

function cx(...names: Array<string | false | undefined>) { return names.filter(Boolean).join(" "); }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
function todayKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function monthKey() { return todayKey().slice(0, 7); }
function gradeLabel(grade: number | null) { return grade === 0 ? "PAUD" : grade ? `Kelas ${grade} SD` : "Jenjang belum diisi"; }

async function assignedClassIds(userId: string) {
  if (!supabase) return [] as string[];
  const [direct, schedule] = await Promise.all([
    supabase.from("class_teachers").select("class_id").eq("user_id", userId),
    supabase.from("schedules").select("class_id").eq("teacher_id", userId).eq("is_active", true),
  ]);
  if (direct.error) throw direct.error;
  const ids = new Set<string>((direct.data ?? []).map(row => row.class_id as string));
  for (const row of schedule.data ?? []) ids.add(row.class_id as string);
  return [...ids];
}

function defaultAssessment(): AssessmentDraft {
  return {
    targetId: "",
    stage: "berkembang",
    note: "",
    followUp: "",
    scores: { target_progress: 2, understanding: 2, practice: 2, independence: 2, participation: 2 },
  };
}

export function JournalWorkspace({ notify, workspace, userId, previewMode, role }: { notify: (message: string) => void; workspace: WorkspaceData; userId?: string; previewMode: boolean; role: Role }) {
  const [mode, setMode] = useState<JournalMode>("class");
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [startedAt, setStartedAt] = useState("16:00");
  const [endedAt, setEndedAt] = useState("17:30");
  const [material, setMaterial] = useState("");
  const [achievement, setAchievement] = useState("");
  const [obstacles, setObstacles] = useState("");
  const [improvementPlan, setImprovementPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [classScores, setClassScores] = useState<Record<ScoreKey, number>>({ material_completion: 3, class_engagement: 3, general_understanding: 3, discipline: 3 });
  const [targets, setTargets] = useState<WorkspaceTarget[]>([]);
  const [studentDrafts, setStudentDrafts] = useState<Record<string, AssessmentDraft>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (previewMode || !userId || role !== "Pengajar") { setTeacherClassIds([]); return; }
    assignedClassIds(userId).then(setTeacherClassIds).catch(error => notify(error instanceof Error ? error.message : "Pembagian kelas gagal dimuat"));
  }, [previewMode, role, userId]);

  useEffect(() => {
    if (previewMode || !supabase) return;
    supabase.from("targets").select("id,version_id,school_grade,code,title,description,target_value,target_unit,sort_order").order("school_grade").order("sort_order")
      .then(({ data, error }) => { if (error) notify(error.message); else setTargets((data ?? []) as WorkspaceTarget[]); });
  }, [previewMode]);

  const visibleClasses = useMemo(() => {
    const active = workspace.classes.filter(item => item.is_active);
    if (role !== "Pengajar") return active;
    if (!teacherClassIds.length) return [];
    const allowed = new Set(teacherClassIds);
    return active.filter(item => allowed.has(item.id));
  }, [role, teacherClassIds, workspace.classes]);

  useEffect(() => {
    if (!classId && visibleClasses[0]) setClassId(visibleClasses[0].id);
    if (classId && !visibleClasses.some(item => item.id === classId)) setClassId(visibleClasses[0]?.id ?? "");
  }, [classId, visibleClasses]);

  const selectedClass = workspace.classes.find(item => item.id === classId);
  const enrolledIds = new Set(workspace.enrollments.filter(item => item.class_id === classId).map(item => item.student_id));
  const students = useMemo(() => {
    if (previewMode) return [
      { id: "demo-1", full_name: "Ahmad Fauzan", school_grade: 1, status: "active", group_id: "demo" },
      { id: "demo-2", full_name: "Naila Azzahra", school_grade: 1, status: "active", group_id: "demo" },
    ];
    return workspace.students.filter(student => student.status === "active" && (enrolledIds.size ? enrolledIds.has(student.id) : student.group_id === selectedClass?.group_id));
  }, [previewMode, workspace.students, classId, selectedClass?.group_id, workspace.enrollments]);

  useEffect(() => {
    setStudentDrafts(current => {
      const next: Record<string, AssessmentDraft> = {};
      for (const student of students) next[student.id] = current[student.id] ?? defaultAssessment();
      return next;
    });
  }, [students]);

  const setStudent = (studentId: string, patch: Partial<AssessmentDraft>) => setStudentDrafts(current => ({ ...current, [studentId]: { ...(current[studentId] ?? defaultAssessment()), ...patch } }));
  const setStudentScore = (studentId: string, key: StudentScoreKey, score: number) => setStudentDrafts(current => ({ ...current, [studentId]: { ...(current[studentId] ?? defaultAssessment()), scores: { ...(current[studentId]?.scores ?? defaultAssessment().scores), [key]: score } } }));

  const saveClassJournal = async () => {
    if (previewMode) { notify("Mode pratinjau: jurnal pengajian siap disimpan"); return; }
    if (!supabase || !userId || !classId || !material.trim()) { notify("Kelas dan materi pengajian wajib diisi"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("daily_journals").upsert({
        class_id: classId,
        journal_date: date,
        responsible_user_id: userId,
        teacher_id: userId,
        started_at: startedAt,
        ended_at: endedAt,
        material: material.trim(),
        achievement: achievement.trim() || null,
        obstacles: obstacles.trim() || null,
        improvement_plan: improvementPlan.trim() || null,
        notes: notes.trim() || null,
        rubric_version: RUBRIC_VERSION,
        session_assessment: classScores,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "class_id,journal_date" });
      if (error) throw error;
      notify("Jurnal pengajian tersimpan dengan rubrik standar");
    } catch (error) { notify(error instanceof Error ? error.message : "Jurnal pengajian gagal disimpan"); }
    finally { setSaving(false); }
  };

  const saveIndividualJournal = async () => {
    if (previewMode) { notify("Mode pratinjau: penilaian individu siap disimpan"); return; }
    if (!supabase || !userId || !classId || !students.length) { notify("Pilih kelas yang memiliki siswa terlebih dahulu"); return; }
    const filled = students.filter(student => studentDrafts[student.id]?.note.trim() || studentDrafts[student.id]?.targetId);
    if (!filled.length) { notify("Isi minimal satu penilaian siswa terlebih dahulu"); return; }
    setSaving(true);
    try {
      const existing = await supabase.from("daily_journals").select("id").eq("class_id", classId).eq("journal_date", date).maybeSingle();
      if (existing.error) throw existing.error;
      let journalId = existing.data?.id as string | undefined;
      if (!journalId) {
        const created = await supabase.from("daily_journals").insert({
          class_id: classId,
          journal_date: date,
          responsible_user_id: userId,
          teacher_id: userId,
          started_at: startedAt,
          ended_at: endedAt,
          material: material.trim() || "Penilaian perkembangan individu",
          rubric_version: RUBRIC_VERSION,
          session_assessment: {},
          submitted_at: new Date().toISOString(),
        }).select("id").single();
        if (created.error) throw created.error;
        journalId = created.data.id;
      }
      for (const student of filled) {
        const draft = studentDrafts[student.id];
        const payload = {
          journal_id: journalId,
          student_id: student.id,
          target_id: draft.targetId || null,
          progress_value: stageToValue[draft.stage],
          progress_note: draft.note.trim() || stageLabel[draft.stage],
          rubric_version: RUBRIC_VERSION,
          assessment: { ...draft.scores, stage: draft.stage },
          follow_up: draft.followUp.trim() || null,
          updated_at: new Date().toISOString(),
        };
        if (draft.targetId) {
          const result = await supabase.from("student_progress").upsert(payload, { onConflict: "journal_id,student_id,target_id" });
          if (result.error) throw result.error;
        } else {
          const old = await supabase.from("student_progress").select("id").eq("journal_id", journalId).eq("student_id", student.id).is("target_id", null).limit(1).maybeSingle();
          if (old.error) throw old.error;
          const result = old.data?.id
            ? await supabase.from("student_progress").update(payload).eq("id", old.data.id)
            : await supabase.from("student_progress").insert(payload);
          if (result.error) throw result.error;
        }
      }
      notify(`${filled.length} penilaian individu berhasil disimpan`);
    } catch (error) { notify(error instanceof Error ? error.message : "Penilaian individu gagal disimpan"); }
    finally { setSaving(false); }
  };

  if (role === "Pengajar" && !previewMode && !visibleClasses.length) {
    return <><div className="journal-page-head"><div><span>JURNAL GURU</span><h1>Jurnal Pengajian</h1><p>Kelas jurnal mengikuti pembagian kelas guru.</p></div></div><section className="journal-empty"><Users size={32}/><h2>Belum ada kelas yang ditugaskan</h2><p>PJ Kelompok perlu membuka Tim & Akses → Pembagian Kelas Guru lalu memilih 1–2 kelas untuk akun Anda.</p></section></>;
  }

  return <>
    <div className="journal-page-head"><div><span>JURNAL TERSTRUKTUR</span><h1>Jurnal Pengajian</h1><p>Acara pengajian dan perkembangan individu dinilai dengan fokus berbeda.</p></div><em>{RUBRIC_VERSION}</em></div>
    <div className="journal-tabs"><button className={cx(mode === "class" && "active")} onClick={() => setMode("class")}><ClipboardText size={19}/>Pengajian / Kelas</button><button className={cx(mode === "individual" && "active")} onClick={() => setMode("individual")}><Student size={19}/>Individu Siswa</button></div>
    <section className="journal-context-card">
      <label><span>Kelas yang diampu</span><select value={classId} onChange={event => setClassId(event.target.value)}>{previewMode ? <option value="demo">Kelas Al-Fatihah</option> : visibleClasses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>Tanggal</span><KeyboardInput type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
    </section>

    {mode === "class" ? <>
      <section className="journal-focus-card class-focus"><div className="journal-section-title"><span><ClipboardText size={20}/></span><div><h2>Jurnal Acara Pengajian</h2><p>Menilai kualitas pelaksanaan satu sesi kelas, bukan perkembangan satu anak.</p></div></div>
        <div className="journal-two"><label><span>Jam mulai</span><KeyboardInput type="time" value={startedAt} onChange={event => setStartedAt(event.target.value)}/></label><label><span>Jam selesai</span><KeyboardInput type="time" value={endedAt} onChange={event => setEndedAt(event.target.value)}/></label></div>
        <label><span>Materi yang disampaikan *</span><KeyboardTextarea value={material} onChange={event => setMaterial(event.target.value)} rows={3} placeholder="Contoh: Tilawati jilid 2 halaman 12–15, doa sebelum belajar"/></label>
        <div className="rubric-block"><div className="rubric-title"><strong>Penilaian sesi pengajian</strong><small>Skala 1 = perlu perhatian, 4 = sangat baik</small></div>{classRubric.map(item => <div className="rubric-row" key={item.key}><div><strong>{item.label}</strong><small>{item.hint}</small></div><div className="score-pills">{scoreOptions.map(score => <button key={score} className={cx(classScores[item.key] === score && "active")} onClick={() => setClassScores(value => ({ ...value, [item.key]: score }))}>{score}</button>)}</div></div>)}</div>
        <label><span>Pencapaian kelas</span><KeyboardTextarea value={achievement} onChange={event => setAchievement(event.target.value)} rows={2} placeholder="Apa yang berhasil dicapai kelas hari ini?"/></label>
        <label><span>Kendala pelaksanaan</span><KeyboardTextarea value={obstacles} onChange={event => setObstacles(event.target.value)} rows={2} placeholder="Materi sulit, waktu kurang, suasana kelas, alat bantu, dll."/></label>
        <label><span>Rencana perbaikan pertemuan berikutnya</span><KeyboardTextarea value={improvementPlan} onChange={event => setImprovementPlan(event.target.value)} rows={2} placeholder="Langkah konkret yang akan dilakukan guru."/></label>
        <label><span>Catatan kegiatan</span><KeyboardTextarea value={notes} onChange={event => setNotes(event.target.value)} rows={2} placeholder="Catatan tambahan yang penting untuk rekap bulanan."/></label>
      </section>
      <button className="journal-save" disabled={saving || !classId || !material.trim()} onClick={() => void saveClassJournal()}><Check size={19}/>{saving ? "Menyimpan…" : "Simpan jurnal pengajian"}</button>
    </> : <>
      <section className="journal-focus-card individual-focus"><div className="journal-section-title"><span><Target size={20}/></span><div><h2>Jurnal Perkembangan Individu</h2><p>Setiap anak dinilai terhadap target dan observasi nyata guru. Tidak memakai format acara pengajian.</p></div></div>
        <div className="journal-two"><label><span>Fokus materi / kegiatan</span><KeyboardInput value={material} onChange={event => setMaterial(event.target.value)} placeholder="Opsional: fokus sesi hari ini"/></label><div className="journal-count"><strong>{students.length}</strong><small>siswa di kelas</small></div></div>
        <div className="student-assessment-list">{students.map(student => { const draft = studentDrafts[student.id] ?? defaultAssessment(); const relevantTargets = targets.filter(target => target.school_grade === student.school_grade); return <article className="student-assessment" key={student.id}><header><span className="student-avatar">{initials(student.full_name)}</span><div><h3>{student.full_name}</h3><p>{gradeLabel(student.school_grade)}</p></div><b>{stageToValue[draft.stage]}%</b></header><label><span>Target yang dinilai</span><select value={draft.targetId} onChange={event => setStudent(student.id, { targetId: event.target.value })}><option value="">Penilaian umum</option>{relevantTargets.map(target => <option key={target.id} value={target.id}>{target.code ? `${target.code} · ` : ""}{target.title}</option>)}</select></label><label><span>Status perkembangan</span><select value={draft.stage} onChange={event => setStudent(student.id, { stage: event.target.value as AssessmentDraft["stage"] })}>{Object.entries(stageLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="student-rubric">{studentRubric.map(item => <div key={item.key}><span>{item.label}</span><div className="score-pills mini">{scoreOptions.map(score => <button key={score} className={cx(draft.scores[item.key] === score && "active")} onClick={() => setStudentScore(student.id, item.key, score)}>{score}</button>)}</div></div>)}</div><label><span>Catatan observasi</span><KeyboardTextarea value={draft.note} onChange={event => setStudent(student.id, { note: event.target.value })} rows={2} placeholder="Contoh: sudah lancar membaca, masih tertukar huruf tertentu, perlu dibimbing saat praktik."/></label><label><span>Tindak lanjut</span><KeyboardTextarea value={draft.followUp} onChange={event => setStudent(student.id, { followUp: event.target.value })} rows={2} placeholder="Latihan / pendampingan yang perlu dilakukan berikutnya."/></label></article>; })}{!students.length ? <div className="journal-empty compact"><Student size={28}/><p>Belum ada siswa aktif pada kelas ini.</p></div> : null}</div>
      </section>
      <button className="journal-save" disabled={saving || !classId || !students.length} onClick={() => void saveIndividualJournal()}><Check size={19}/>{saving ? "Menyimpan…" : "Simpan penilaian individu"}</button>
    </>}
  </>;
}

export function TeacherClassAssignmentPanel({ notify, workspace, accounts, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; accounts: WorkspaceAccount[]; previewMode: boolean }) {
  const teachers = accounts.filter(account => account.role === "pengajar" && account.is_active);
  const [assignment, setAssignment] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState("");

  const load = async () => {
    if (previewMode || !supabase) return;
    const { data, error } = await supabase.from("class_teachers").select("class_id,user_id");
    if (error) { notify(error.message); return; }
    const next: Record<string, string[]> = {};
    for (const row of data ?? []) (next[row.user_id] ||= []).push(row.class_id);
    setAssignment(next);
  };
  useEffect(() => { void load(); }, [previewMode, accounts.length]);

  const toggle = (userId: string, classId: string) => {
    const current = assignment[userId] ?? [];
    const next = current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId];
    if (next.length > 2) { notify("Setiap guru maksimal memegang 2 kelas"); return; }
    setAssignment(value => ({ ...value, [userId]: next }));
  };
  const save = async (userId: string) => {
    if (previewMode) { notify("Pembagian kelas siap disimpan pada data nyata"); return; }
    if (!supabase) return;
    setSaving(userId);
    const { error } = await supabase.rpc("set_teacher_classes", { p_user_id: userId, p_class_ids: assignment[userId] ?? [] });
    setSaving("");
    notify(error ? error.message : "Pembagian kelas guru berhasil disimpan");
    if (!error) await load();
  };
  return <section className="teacher-class-panel"><div className="journal-section-title"><span><Users size={20}/></span><div><h2>Pembagian Kelas Guru</h2><p>Tentukan 1–2 kelas yang benar-benar menjadi tanggung jawab setiap pengajar. Pilihan ini mengunci jurnal guru ke kelasnya sendiri.</p></div></div>{teachers.length ? teachers.map(teacher => { const groupClasses = workspace.classes.filter(item => item.is_active && (!teacher.group_id || item.group_id === teacher.group_id)); const selected = assignment[teacher.user_id] ?? []; return <article key={teacher.user_id}><header><div><strong>{teacher.full_name}</strong><small>@{teacher.username || "pengajar"} · {selected.length}/2 kelas</small></div><button disabled={saving === teacher.user_id} onClick={() => void save(teacher.user_id)}>{saving === teacher.user_id ? "Menyimpan…" : "Simpan"}</button></header><div className="teacher-class-options">{groupClasses.map(klass => <button key={klass.id} className={cx(selected.includes(klass.id) && "active")} onClick={() => toggle(teacher.user_id, klass.id)}><span>{selected.includes(klass.id) ? "✓" : "+"}</span>{klass.name}</button>)}</div></article>; }) : <div className="journal-empty compact"><Users size={28}/><p>Belum ada akun Pengajar aktif pada kelompok ini.</p></div>}</section>;
}

export function MonthlyAiAnalysis({ notify, workspace, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; previewMode: boolean }) {
  const [classId, setClassId] = useState(workspace.classes[0]?.id ?? "");
  const [month, setMonth] = useState(monthKey());
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!classId && workspace.classes[0]) setClassId(workspace.classes[0].id); }, [classId, workspace.classes]);
  const run = async () => {
    if (previewMode) { setAnalysis({ summary: "Contoh analisis bulanan akan muncul dari presensi, jurnal pengajian, target, dan penilaian individu.", strengths: ["Data kelas tersusun dengan rubrik yang konsisten."], attention: ["Lengkapi penilaian individu agar analisis murid lebih akurat."], class_recommendations: ["Pertahankan jurnal setiap pertemuan."], next_month_focus: ["Target yang belum tercapai."], data_quality: { status: "terbatas", notes: ["Mode pratinjau"] }, rubric_version: RUBRIC_VERSION }); setModel("preview"); return; }
    if (!supabase || !classId) { notify("Pilih kelas terlebih dahulu"); return; }
    setLoading(true); setAnalysis(null);
    const { data, error } = await supabase.functions.invoke("analyze-monthly-journal", { body: { classId, month } });
    setLoading(false);
    if (error || data?.error) { notify(data?.error || "Analisis AI belum dapat diproses"); return; }
    setAnalysis(data.analysis as AiAnalysis); setModel(data.model || "AI"); notify(data.cached ? "Analisis AI sebelumnya dimuat" : "Analisis AI bulanan berhasil dibuat");
  };

  return <section className="monthly-ai-panel"><div className="journal-section-title"><span><Sparkle size={21} weight="fill"/></span><div><h2>Analisis AI Bulanan</h2><p>Membaca presensi, jurnal pengajian, target, dan perkembangan individu dengan standar {RUBRIC_VERSION}.</p></div></div><div className="journal-two"><label><span>Kelas</span><select value={classId} onChange={event => setClassId(event.target.value)}>{workspace.classes.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Bulan</span><KeyboardInput type="month" value={month} onChange={event => setMonth(event.target.value)}/></label></div><button className="ai-run-button" disabled={loading || !classId} onClick={() => void run()}><Sparkle size={18}/>{loading ? "Menganalisis data…" : "Analisis dengan AI"}</button>{analysis ? <div className="ai-result"><div className="ai-result-head"><strong>Ringkasan</strong><small>{model} · {analysis.rubric_version || RUBRIC_VERSION}</small></div><p>{analysis.summary}</p><AiList title="Kekuatan" items={analysis.strengths}/><AiList title="Perlu perhatian" items={analysis.attention}/>{analysis.students_needing_support?.length ? <div className="ai-list"><strong>Siswa perlu pendampingan</strong>{analysis.students_needing_support.map((item, index) => <article key={`${item.student_id || item.name}-${index}`}><b>{item.name || "Siswa"}</b><p>{item.reason}</p><small>Tindak lanjut: {item.next_action || "Belum ditentukan"}</small></article>)}</div> : null}<AiList title="Rekomendasi kelas" items={analysis.class_recommendations}/><AiList title="Fokus bulan berikutnya" items={analysis.next_month_focus}/>{analysis.data_quality ? <div className="ai-quality"><strong>Kualitas data: {analysis.data_quality.status}</strong>{analysis.data_quality.notes?.map(note => <small key={note}>{note}</small>)}</div> : null}</div> : null}</section>;
}

function AiList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return <div className="ai-list"><strong>{title}</strong><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></div>;
}
