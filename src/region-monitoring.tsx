import { useEffect, useMemo, useState } from "react";
import { Buildings, CalendarCheck, CaretRight, ChartLineUp, CheckCircle, ClipboardText, MapPin, PencilSimple, Plus, Student, Users, WarningCircle, X } from "@phosphor-icons/react";
import { loadAttendanceSummary, type WorkspaceData } from "./lib/data";
import { supabase } from "./lib/supabase";
import { KeyboardInput } from "./mobile";
import "./region-monitoring.css";

type Role = "Admin Desa" | "Admin Daerah";
type AttendanceRow = { student_id: string; status: "hadir" | "izin" | "alpha"; session_date: string; class_id: string };
type SessionRow = { id: string; class_id: string; session_date: string; submitted_at: string | null };
type JournalRow = {
  id: string;
  class_id: string;
  journal_date: string;
  material: string | null;
  achievement: string | null;
  obstacles: string | null;
  improvement_plan: string | null;
  session_assessment: Record<string, number> | null;
};
type ProgressRow = { id: string; journal_id: string; student_id: string; progress_value: number | null; created_at: string };
type RegionScreen = "attendance" | "journal" | "reports" | "students" | "team" | "chat" | "region";

type Notify = (message: string) => void;

const monthKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const pct = (part: number, total: number) => total ? Math.round((part / total) * 100) : 0;
const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

function monthDates(month: string) {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(year, m, 0).getDate();
  const today = todayKey();
  return Array.from({ length: last }, (_, index) => {
    const date = `${year}-${String(m).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    const d = new Date(year, m - 1, index + 1, 12);
    return { date, weekday: d.getDay(), pastOrToday: date <= today };
  });
}

function expectedClassDates(workspace: WorkspaceData, classId: string, month: string) {
  const weekdays = new Set(workspace.schedules.filter(item => item.class_id === classId && item.is_active).map(item => item.weekday));
  if (!weekdays.size) return [] as string[];
  return monthDates(month).filter(item => item.pastOrToday && weekdays.has(item.weekday)).map(item => item.date);
}

function AreaMetric({ value, label, tone }: { value: string | number; label: string; tone?: "warning" | "success" }) {
  return <article className={cx("region-metric", tone)}><strong>{value}</strong><span>{label}</span></article>;
}

export function RegionalMonitoringHome({ role, workspace, previewMode, go, notify }: { role: Role; workspace: WorkspaceData; previewMode: boolean; go: (screen: RegionScreen) => void; notify: Notify }) {
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(!previewMode);
  const month = monthKey();

  useEffect(() => {
    if (previewMode || !supabase) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([
      loadAttendanceSummary(),
      supabase.from("attendance_sessions").select("id,class_id,session_date,submitted_at").gte("session_date", `${month}-01`).lte("session_date", `${month}-31`),
      supabase.from("daily_journals").select("id,class_id,journal_date,material,achievement,obstacles,improvement_plan,session_assessment").gte("journal_date", `${month}-01`).lte("journal_date", `${month}-31`),
      supabase.from("student_progress").select("id,journal_id,student_id,progress_value,created_at").gte("created_at", `${month}-01T00:00:00+07:00`),
    ]).then(([attendanceRows, sessionResult, journalResult, progressResult]) => {
      if (!active) return;
      if (sessionResult.error) throw sessionResult.error;
      if (journalResult.error) throw journalResult.error;
      if (progressResult.error) throw progressResult.error;
      setAttendance(attendanceRows.filter(row => row.session_date.startsWith(month)));
      setSessions((sessionResult.data ?? []) as SessionRow[]);
      setJournals((journalResult.data ?? []) as JournalRow[]);
      setProgress((progressResult.data ?? []) as ProgressRow[]);
    }).catch(error => notify(error instanceof Error ? error.message : "Monitoring wilayah gagal dimuat"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [previewMode, month]);

  const activeGroups = workspace.groups;
  const activeClasses = workspace.classes.filter(item => item.is_active);
  const activeStudents = workspace.students.filter(item => item.status === "active");

  const allClassIds = new Set(activeClasses.map(item => item.id));
  const monthAttendance = attendance.filter(row => allClassIds.has(row.class_id));
  const present = monthAttendance.filter(row => row.status === "hadir").length;
  const attendanceRate = pct(present, monthAttendance.length);
  const expectedTotal = activeClasses.reduce((sum, klass) => sum + expectedClassDates(workspace, klass.id, month).length, 0);
  const completedSessions = new Set(sessions.map(item => `${item.class_id}|${item.session_date}`)).size;
  const completedJournals = new Set(journals.map(item => `${item.class_id}|${item.journal_date}`)).size;
  const attendanceCompletion = pct(completedSessions, expectedTotal);
  const journalCompletion = pct(completedJournals, expectedTotal);

  const childRows = useMemo(() => {
    const makeRow = (id: string, name: string, groupIds: string[]) => {
      const classIds = new Set(activeClasses.filter(item => groupIds.includes(item.group_id)).map(item => item.id));
      const studentIds = new Set(activeStudents.filter(item => groupIds.includes(item.group_id)).map(item => item.id));
      const rows = monthAttendance.filter(item => classIds.has(item.class_id));
      const expected = [...classIds].reduce((sum, classId) => sum + expectedClassDates(workspace, classId, month).length, 0);
      const sessionCount = new Set(sessions.filter(item => classIds.has(item.class_id)).map(item => `${item.class_id}|${item.session_date}`)).size;
      const journalCount = new Set(journals.filter(item => classIds.has(item.class_id)).map(item => `${item.class_id}|${item.journal_date}`)).size;
      const progressRows = progress.filter(item => studentIds.has(item.student_id) && typeof item.progress_value === "number");
      const avgProgress = progressRows.length ? Math.round(progressRows.reduce((sum, item) => sum + Number(item.progress_value ?? 0), 0) / progressRows.length) : null;
      return {
        id, name, groupIds,
        groups: groupIds.length,
        students: studentIds.size,
        classes: classIds.size,
        attendance: pct(rows.filter(item => item.status === "hadir").length, rows.length),
        attendanceCompletion: pct(sessionCount, expected),
        journalCompletion: pct(journalCount, expected),
        avgProgress,
        expected,
      };
    };

    if (role === "Admin Daerah") {
      return workspace.villages.map(village => makeRow(village.id, `Desa ${village.name}`, workspace.groups.filter(group => group.village_id === village.id).map(group => group.id)));
    }
    const village = workspace.villages[0];
    return workspace.groups.filter(group => !village || group.village_id === village.id).map(group => makeRow(group.id, `Kelompok ${group.name}`, [group.id]));
  }, [role, workspace.villages, workspace.groups, activeClasses, activeStudents, monthAttendance, sessions, journals, progress, month]);

  const lowAttendanceStudents = useMemo(() => activeStudents.map(student => {
    const rows = monthAttendance.filter(row => row.student_id === student.id);
    return { student, total: rows.length, rate: pct(rows.filter(row => row.status === "hadir").length, rows.length) };
  }).filter(item => item.total >= 2 && item.rate < 75).sort((a, b) => a.rate - b.rate), [activeStudents, monthAttendance]);

  const incomplete = childRows.filter(item => item.expected > 0 && (item.attendanceCompletion < 100 || item.journalCompletion < 100));
  const scopeName = role === "Admin Daerah" ? (workspace.areas[0]?.name ?? "Daerah") : (workspace.villages[0]?.name ? `Desa ${workspace.villages[0].name}` : "Desa");
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));

  return <section className="regional-monitoring">
    <header className="region-hero">
      <div><span>{role === "Admin Daerah" ? "MONITORING DAERAH" : "MONITORING DESA"}</span><h1>{scopeName}</h1><p>Ringkasan nyata dari kelompok, kelas, presensi, jurnal, dan perkembangan pada wilayah yang menjadi tanggung jawab akun ini.</p></div>
      <div className="region-period"><CalendarCheck size={18}/><span><small>Periode</small><strong>{monthLabel}</strong></span></div>
    </header>

    <div className="region-metrics">
      <AreaMetric value={activeGroups.length} label="Kelompok dinaungi" />
      <AreaMetric value={activeStudents.length} label="Siswa aktif" />
      <AreaMetric value={`${attendanceRate}%`} label="Kehadiran tercatat" />
      <AreaMetric value={`${journalCompletion}%`} label="Kelengkapan jurnal" tone={journalCompletion < 80 ? "warning" : "success"} />
    </div>

    <div className="region-quick-actions">
      <button onClick={() => go("attendance")}><CalendarCheck size={18}/><span><strong>Presensi</strong><small>Pantau rekap per kelas</small></span><CaretRight size={16}/></button>
      <button onClick={() => go("journal")}><ClipboardText size={18}/><span><strong>Jurnal</strong><small>Pantau isi dan kelengkapan</small></span><CaretRight size={16}/></button>
      <button onClick={() => go("reports")}><ChartLineUp size={18}/><span><strong>Laporan</strong><small>Analisis bulanan</small></span><CaretRight size={16}/></button>
      <button onClick={() => go("region")}><Buildings size={18}/><span><strong>Wilayah</strong><small>Struktur naungan</small></span><CaretRight size={16}/></button>
    </div>

    <section className="region-panel">
      <div className="region-panel-head"><div><span>NAUNGAN</span><h2>{role === "Admin Daerah" ? "Pantauan per desa" : "Pantauan per kelompok"}</h2></div><small>Data otomatis mengikuti lingkup akun</small></div>
      {loading ? <div className="region-empty">Memuat data monitoring…</div> : childRows.length ? <div className="region-unit-list">
        {childRows.map(item => <article className="region-unit-row" key={item.id}>
          <div className="region-unit-main"><span className="region-unit-icon">{role === "Admin Daerah" ? <Buildings size={19}/> : <MapPin size={19}/>}</span><div><strong>{item.name}</strong><small>{item.groups} kelompok · {item.classes} kelas · {item.students} siswa</small></div></div>
          <div className="region-unit-stat"><span>Kehadiran</span><b>{item.attendance}%</b></div>
          <div className="region-unit-stat"><span>Presensi terisi</span><b>{item.attendanceCompletion}%</b></div>
          <div className="region-unit-stat"><span>Jurnal terisi</span><b>{item.journalCompletion}%</b></div>
          <div className="region-unit-stat"><span>Progres</span><b>{item.avgProgress === null ? "—" : `${item.avgProgress}%`}</b></div>
        </article>)}
      </div> : <div className="region-empty">Belum ada unit di bawah wilayah ini.</div>}
    </section>

    <div className="region-two-column">
      <section className="region-panel">
        <div className="region-panel-head"><div><span>TINDAK LANJUT</span><h2>Data yang perlu dilengkapi</h2></div><button onClick={() => go("journal")}>Buka jurnal</button></div>
        {incomplete.length ? <div className="region-alert-list">{incomplete.slice(0, 8).map(item => <article key={item.id}><WarningCircle size={18}/><span><strong>{item.name}</strong><small>Presensi {item.attendanceCompletion}% · jurnal {item.journalCompletion}%</small></span></article>)}</div> : <div className="region-success"><CheckCircle size={20}/><span><strong>Data bulan ini lengkap</strong><small>Tidak ada unit dengan kelengkapan presensi/jurnal yang tertinggal.</small></span></div>}
      </section>

      <section className="region-panel">
        <div className="region-panel-head"><div><span>INDIVIDU</span><h2>Siswa perlu dipantau</h2></div><button onClick={() => go("reports")}>Buka laporan</button></div>
        {lowAttendanceStudents.length ? <div className="region-alert-list">{lowAttendanceStudents.slice(0, 8).map(item => <article key={item.student.id}><Student size={18}/><span><strong>{item.student.full_name}</strong><small>Kehadiran {item.rate}% dari {item.total} catatan presensi</small></span></article>)}</div> : <div className="region-success"><CheckCircle size={20}/><span><strong>Belum ada sinyal kehadiran rendah</strong><small>Daftar akan muncul setelah data presensi bulan ini cukup.</small></span></div>}
      </section>
    </div>
  </section>;
}

export function RegionalJournalMonitor({ workspace, role, previewMode, notify }: { workspace: WorkspaceData; role: Role; previewMode: boolean; notify: Notify }) {
  const [month, setMonth] = useState(monthKey());
  const [groupId, setGroupId] = useState(workspace.groups[0]?.id ?? "");
  const visibleClasses = workspace.classes.filter(item => item.is_active && item.group_id === groupId);
  const [classId, setClassId] = useState(visibleClasses[0]?.id ?? "");
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(!previewMode);

  useEffect(() => {
    if (previewMode || !supabase) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from("daily_journals").select("id,class_id,journal_date,material,achievement,obstacles,improvement_plan,session_assessment").gte("journal_date", `${month}-01`).lte("journal_date", `${month}-31`).order("journal_date", { ascending: false }),
      supabase.from("student_progress").select("id,journal_id,student_id,progress_value,created_at").gte("created_at", `${month}-01T00:00:00+07:00`),
    ]).then(([journalResult, progressResult]) => {
      if (!active) return;
      if (journalResult.error) throw journalResult.error;
      if (progressResult.error) throw progressResult.error;
      setJournals((journalResult.data ?? []) as JournalRow[]);
      setProgress((progressResult.data ?? []) as ProgressRow[]);
    }).catch(error => notify(error instanceof Error ? error.message : "Jurnal wilayah gagal dimuat"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, previewMode]);

  useEffect(() => {
    if (!groupId || !workspace.groups.some(item => item.id === groupId)) setGroupId(workspace.groups[0]?.id ?? "");
  }, [groupId, workspace.groups]);
  useEffect(() => {
    if (!classId || !visibleClasses.some(item => item.id === classId)) setClassId(visibleClasses[0]?.id ?? "");
  }, [groupId, classId, visibleClasses]);

  const visibleGroups = workspace.groups;
  const visibleJournals = journals.filter(item => item.class_id === classId);
  const journalIds = new Set(visibleJournals.map(item => item.id));
  const visibleProgress = progress.filter(item => journalIds.has(item.journal_id));
  const avgSessionScore = (() => {
    const values = visibleJournals.flatMap(item => Object.values(item.session_assessment ?? {}).filter(value => typeof value === "number"));
    return values.length ? (values.reduce((sum, value) => sum + Number(value), 0) / values.length).toFixed(1) : "—";
  })();
  const avgProgress = (() => {
    const values = visibleProgress.map(item => item.progress_value).filter((value): value is number => typeof value === "number");
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  })();
  const selectedGroup = workspace.groups.find(item => item.id === groupId);
  const selectedClass = workspace.classes.find(item => item.id === classId);
  const selectedVillage = workspace.villages.find(item => item.id === selectedGroup?.village_id);

  return <section className="regional-journal">
    <header className="region-hero compact">
      <div><span>MONITORING JURNAL</span><h1>Jurnal Wilayah</h1><p>Pilih kelompok lalu kelas. Data jurnal tidak dicampur antar-kelompok. Mode ini hanya baca; pengisian tetap dilakukan PJ Kelompok/Pengajar.</p></div>
    </header>
    <div className="region-filter-grid">
      <label><span>Kelompok</span><select value={groupId} onChange={event => { setGroupId(event.target.value); setClassId(""); }}>{visibleGroups.map(group => { const village=workspace.villages.find(item=>item.id===group.village_id); return <option key={group.id} value={group.id}>{role==="Admin Daerah"&&village?`${village.name} · ${group.name}`:group.name}</option>; })}</select></label>
      <label><span>Kelas</span><select value={classId} onChange={event => setClassId(event.target.value)} disabled={!visibleClasses.length}>{visibleClasses.length ? visibleClasses.map(klass => <option key={klass.id} value={klass.id}>{klass.name}</option>) : <option value="">Belum ada kelas</option>}</select></label>
      <label><span>Bulan</span><KeyboardInput type="month" value={month} onChange={event => setMonth(event.target.value)}/></label>
    </div>
    <div className="region-scope-note"><strong>{selectedClass?.name ?? "Pilih kelas"}</strong><span>{selectedVillage?.name ? `${selectedVillage.name} · ` : ""}{selectedGroup?.name ?? "Kelompok"}</span></div>
    <div className="region-metrics journal">
      <AreaMetric value={visibleJournals.length} label="Jurnal pengajian" />
      <AreaMetric value={visibleProgress.length} label="Penilaian individu" />
      <AreaMetric value={avgSessionScore} label="Rata-rata rubrik / 4" />
      <AreaMetric value={avgProgress === null ? "—" : `${avgProgress}%`} label="Rata-rata progres" />
    </div>
    <section className="region-panel">
      <div className="region-panel-head"><div><span>RIWAYAT</span><h2>Jurnal {selectedClass?.name ?? "kelas"}</h2></div><small>{visibleJournals.length} jurnal pada bulan aktif</small></div>
      {loading ? <div className="region-empty">Memuat jurnal…</div> : visibleJournals.length ? <div className="regional-journal-list">
        {visibleJournals.map(item => {
          const klass = workspace.classes.find(row => row.id === item.class_id);
          const group = workspace.groups.find(row => row.id === klass?.group_id);
          const individualCount = progress.filter(row => row.journal_id === item.id).length;
          return <article key={item.id}>
            <div className="journal-monitor-head"><span><ClipboardText size={18}/></span><div><strong>{klass?.name ?? "Kelas"}</strong><small>{group?.name ?? "Kelompok"} · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(`${item.journal_date}T12:00:00`))}</small></div><b>{individualCount} individu</b></div>
            <div className="journal-monitor-body"><p><strong>Materi</strong>{item.material || "Belum diisi"}</p>{item.achievement ? <p><strong>Pencapaian</strong>{item.achievement}</p> : null}{item.obstacles ? <p><strong>Kendala</strong>{item.obstacles}</p> : null}{item.improvement_plan ? <p><strong>Tindak lanjut</strong>{item.improvement_plan}</p> : null}</div>
          </article>;
        })}
      </div> : <div className="region-empty">Belum ada jurnal pada kelas dan bulan yang dipilih.</div>}
    </section>
  </section>;
}

type RegionDraft =
  | { kind: "village"; id?: string; name: string; areaId: string }
  | { kind: "group"; id?: string; name: string; villageId: string; reminderTime: string; studyDays: number[] };

const dayLabels = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

export function RegionStructureManager({ role, workspace, refresh, notify, previewMode }: { role: Role; workspace: WorkspaceData; refresh: () => Promise<void>; notify: Notify; previewMode: boolean }) {
  const [draft, setDraft] = useState<RegionDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const areaId = workspace.areas[0]?.id ?? "";
  const villageForAdmin = workspace.villages[0];

  const openVillage = (id?: string) => {
    const village = workspace.villages.find(item => item.id === id);
    setDraft({ kind: "village", id, name: village?.name ?? "", areaId: village?.area_id ?? areaId });
  };
  const openGroup = (id?: string, villageId?: string) => {
    const group = workspace.groups.find(item => item.id === id);
    setDraft({ kind: "group", id, name: group?.name ?? "", villageId: group?.village_id ?? villageId ?? villageForAdmin?.id ?? "", reminderTime: group?.reminder_time?.slice(0,5) ?? "20:00", studyDays: group?.study_days ?? [] });
  };
  const submit = async () => {
    if (!draft || !draft.name.trim()) return;
    if (previewMode || !supabase) { notify("Mode pratinjau: perubahan wilayah tidak disimpan"); setDraft(null); return; }
    setSaving(true);
    try {
      if (draft.kind === "village") {
        const payload = { area_id: draft.areaId, name: draft.name.trim(), updated_at: new Date().toISOString() };
        const result = draft.id ? await supabase.from("villages").update(payload).eq("id", draft.id) : await supabase.from("villages").insert(payload);
        if (result.error) throw result.error;
      } else {
        const payload = { village_id: draft.villageId, name: draft.name.trim(), study_days: draft.studyDays, reminder_time: draft.reminderTime, updated_at: new Date().toISOString() };
        const result = draft.id ? await supabase.from("groups").update(payload).eq("id", draft.id) : await supabase.from("groups").insert(payload);
        if (result.error) throw result.error;
      }
      await refresh();
      notify(draft.id ? "Data wilayah diperbarui" : "Unit wilayah berhasil ditambahkan");
      setDraft(null);
    } catch (error) { notify(error instanceof Error ? error.message : "Data wilayah gagal disimpan"); }
    finally { setSaving(false); }
  };

  return <section className="region-structure">
    <header className="region-hero compact">
      <div><span>STRUKTUR WILAYAH</span><h1>{role === "Admin Daerah" ? "Desa & Kelompok" : "Kelompok Desa"}</h1><p>{role === "Admin Daerah" ? "Kelola desa dan kelompok yang berada di bawah daerah Anda." : "Kelola kelompok yang berada di bawah desa Anda."} Penghapusan sengaja tidak disediakan agar histori data tetap aman.</p></div>
      {role === "Admin Daerah" ? <button className="region-primary" onClick={() => openVillage()}><Plus size={17}/>Tambah desa</button> : villageForAdmin ? <button className="region-primary" onClick={() => openGroup(undefined, villageForAdmin.id)}><Plus size={17}/>Tambah kelompok</button> : null}
    </header>

    <div className="region-structure-list">
      {workspace.villages.map(village => {
        const groups = workspace.groups.filter(group => group.village_id === village.id);
        return <section className="region-village-card" key={village.id}>
          <header><div><span>DESA</span><h2>{village.name}</h2><small>{groups.length} kelompok</small></div><div>{role === "Admin Daerah" ? <button onClick={() => openVillage(village.id)}><PencilSimple size={16}/>Edit desa</button> : null}<button onClick={() => openGroup(undefined, village.id)}><Plus size={16}/>Tambah kelompok</button></div></header>
          <div className="region-group-list">{groups.map(group => {
            const students = workspace.students.filter(student => student.group_id === group.id && student.status === "active").length;
            const classes = workspace.classes.filter(klass => klass.group_id === group.id && klass.is_active).length;
            return <article key={group.id}><span className="region-unit-icon"><MapPin size={18}/></span><div><strong>{group.name}</strong><small>{students} siswa · {classes} kelas · pengingat {group.reminder_time?.slice(0,5) ?? "20:00"}</small></div><button onClick={() => openGroup(group.id, village.id)}><PencilSimple size={16}/>Edit</button></article>;
          })}{!groups.length ? <div className="region-empty compact">Belum ada kelompok di desa ini.</div> : null}</div>
        </section>;
      })}
    </div>

    {draft ? <div className="region-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDraft(null); }}><section className="region-modal">
      <header><div><span>{draft.kind === "village" ? "DESA" : "KELOMPOK"}</span><h2>{draft.id ? "Edit data" : "Tambah data"}</h2></div><button onClick={() => setDraft(null)}><X size={18}/></button></header>
      <label><span>Nama {draft.kind === "village" ? "desa" : "kelompok"}</span><KeyboardInput value={draft.name} onChange={event => setDraft(current => current ? { ...current, name: event.target.value } as RegionDraft : current)}/></label>
      {draft.kind === "group" ? <>
        {role === "Admin Daerah" ? <label><span>Desa induk</span><select value={draft.villageId} onChange={event => setDraft(current => current && current.kind === "group" ? { ...current, villageId: event.target.value } : current)}>{workspace.villages.map(village => <option key={village.id} value={village.id}>{village.name}</option>)}</select></label> : null}
        <label><span>Jam pengingat</span><KeyboardInput type="time" value={draft.reminderTime} onChange={event => setDraft(current => current && current.kind === "group" ? { ...current, reminderTime: event.target.value } : current)}/></label>
        <div className="region-day-picker"><span>Hari pengajian rutin</span><div>{dayLabels.map((label, day) => <button type="button" key={day} className={cx(draft.studyDays.includes(day) && "active")} onClick={() => setDraft(current => current && current.kind === "group" ? { ...current, studyDays: current.studyDays.includes(day) ? current.studyDays.filter(value => value !== day) : [...current.studyDays, day].sort() } : current)}>{label}</button>)}</div></div>
      </> : null}
      <div className="region-modal-actions"><button onClick={() => setDraft(null)}>Batal</button><button className="primary" disabled={saving || !draft.name.trim()} onClick={() => void submit()}>{saving ? "Menyimpan…" : "Simpan"}</button></div>
    </section></div> : null}
  </section>;
}
