import { useEffect, useMemo, useState } from "react";
import "@fontsource-variable/plus-jakarta-sans";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { emptyWorkspace, loadAccounts, loadWorkspace, manageAccount, saveAttendance, saveDailyJournal, saveStudent, setStudentStatus, type AccountRole, type LoginActivity, type WorkspaceAccount, type WorkspaceData, type WorkspaceStudent } from "./lib/data";
import {
  Bell,
  CalendarBlank,
  CaretRight,
  ChartLineUp,
  Check,
  CheckCircle,
  ClipboardText,
  Clock,
  Database,
  DownloadSimple,
  FilePpt,
  Gear,
  House,
  MagnifyingGlass,
  Moon,
  PencilSimple,
  Plus,
  SignOut,
  Student,
  Sun,
  Target,
  Trash,
  UploadSimple,
  UserCircle,
  Users,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { BottomSheet, KeyboardInput, KeyboardTextarea, MobileScroll } from "./mobile";

type Screen = "home" | "agenda" | "attendance" | "journal" | "students" | "targets" | "reports" | "team" | "chat" | "settings" | "admin";
type Role = "Pengajar" | "PJ Kelompok" | "Admin Desa" | "Admin Daerah" | "Super Admin";
type Attendance = "H" | "I" | "A";

const navItems: { id: Screen; label: string; icon: typeof House }[] = [
  { id: "home", label: "Beranda", icon: House },
  { id: "agenda", label: "Agenda", icon: CalendarBlank },
  { id: "attendance", label: "Presensi", icon: Users },
  { id: "reports", label: "Laporan", icon: ChartLineUp },
];

const menuItems: { id: Screen; label: string; icon: typeof House; hint: string }[] = [
  { id: "journal", label: "Jurnal", icon: ClipboardText, hint: "Harian dan bulanan" },
  { id: "students", label: "Database Anak", icon: Database, hint: "Data, foto, dan kelas" },
  { id: "targets", label: "Target", icon: Target, hint: "Target tiap jenjang" },
  { id: "team", label: "Tim & Akses", icon: Users, hint: "Anggota dan login" },
  { id: "chat", label: "Komunikasi", icon: Bell, hint: "Chat dan pengumuman" },
  { id: "settings", label: "Pengaturan", icon: Gear, hint: "Profil, AI, dan tema" },
];

const desktopNavItems = [
  ...navItems,
  ...menuItems,
];

const superAdminItem = { id: "admin" as Screen, label: "Super Admin", icon: UserCircle, hint: "Akun, akses, dan login" };

const demoStudents = [
  { id: 1, name: "Ahmad Fauzan", grade: "Kelas 1 SD", initials: "AF", active: true },
  { id: 2, name: "Naila Azzahra", grade: "Kelas 3 SD", initials: "NA", active: true },
  { id: 3, name: "Rizki Maulana", grade: "Kelas 2 SD", initials: "RM", active: true },
  { id: 4, name: "Salma Nuraini", grade: "PAUD", initials: "SN", active: true },
  { id: 5, name: "Dimas Pratama", grade: "Kelas 4 SD", initials: "DP", active: false },
];

function cx(...names: Array<string | false | undefined>) {
  return names.filter(Boolean).join(" ");
}

export default function Prototype() {
  const [screen, setScreen] = useState<Screen>("home");
  const [dark, setDark] = useState(true);
  const [role, setRole] = useState<Role>("PJ Kelompok");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [accessReady, setAccessReady] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace);
  const [dataState, setDataState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const previewMode = !isSupabaseConfigured || new URLSearchParams(window.location.search).get("preview") === "1";

  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    if (!supabase || previewMode) return;
    supabase.auth.getUser().then(({ data }) => {
      setAuthUser(data.user ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [previewMode]);

  useEffect(() => {
    if (!supabase || !authUser || previewMode) return;
    setAccessReady(false);
    supabase.from("memberships").select("role").eq("user_id", authUser.id).eq("is_active", true).limit(1).maybeSingle()
      .then(async ({ data, error }) => {
        const roles: Record<string, Role> = { super_admin: "Super Admin", admin_daerah: "Admin Daerah", admin_desa: "Admin Desa", pj_kelompok: "PJ Kelompok", pengajar: "Pengajar" };
        if (error || !data?.role || !roles[data.role]) {
          setLoginMessage("Akun tidak aktif atau belum memiliki akses. Hubungi Super Admin.");
          await supabase?.auth.signOut();
          return;
        }
        setRole(roles[data.role]);
        setAccessReady(true);
        const marker = `one-pro-login-${authUser.id}`;
        if (!sessionStorage.getItem(marker)) {
          sessionStorage.setItem(marker, "1");
          void manageAccount({ action: "record-login" }).catch(console.error);
        }
      });
  }, [authUser, previewMode]);

  const refreshWorkspace = async () => {
    if (!authUser || previewMode) return;
    setDataState("loading");
    try {
      setWorkspace(await loadWorkspace());
      setDataState("ready");
    } catch (error) {
      console.error(error);
      setDataState("error");
      notify("Data gagal dimuat. Periksa koneksi dan akses akun.");
    }
  };

  useEffect(() => { void refreshWorkspace(); }, [authUser, previewMode]);

  const go = (next: Screen) => {
    setScreen(next);
    setMenuOpen(false);
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  if (!previewMode && (!authReady || !authUser)) {
    return <div className={cx("one-pro-shell", dark && "is-dark")}><MobileScroll className="app-screen"><AuthScreen ready={authReady} externalMessage={loginMessage} clearExternalMessage={() => setLoginMessage(null)} /></MobileScroll></div>;
  }

  if (!previewMode && !accessReady) {
    return <div className={cx("one-pro-shell", dark && "is-dark")}><div className="full-loading" role="status">Memeriksa akses akun…</div></div>;
  }

  const allowedNavigation = role === "Super Admin" ? [...desktopNavItems, superAdminItem] : desktopNavItems;
  const allowedMenuItems = role === "Super Admin" ? [...menuItems, superAdminItem] : menuItems;

  return (
    <div className={cx("one-pro-shell", dark && "is-dark")}>
      <aside className="desktop-sidebar" aria-label="Navigasi desktop">
        <button className="desktop-brand" onClick={() => go("home")}>
          <span className="desktop-brand-logo" />
          <span><strong>One Pro</strong><small>Jurnal Digital</small></span>
        </button>
        <div className="desktop-scope"><span>DAERAH</span><strong>Malang Timur</strong><small>{role}</small></div>
        <nav className="desktop-nav">
          {allowedNavigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={cx(screen === item.id && "active")} onClick={() => go(item.id)}><Icon size={20} weight={screen === item.id ? "fill" : "regular"} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="desktop-sidebar-footer"><span className="connection-dot" />Supabase terhubung</div>
      </aside>
      <header className="topbar">
        <button className="brand-button" onClick={() => go("home")} aria-label="Buka beranda">
          <img src="/brand/one-pro-logo.svg" alt="One Pro" />
          <span><strong>One Pro</strong><small>Jurnal Digital</small></span>
        </button>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label={dark ? "Gunakan mode terang" : "Gunakan mode gelap"}>
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="icon-button notification-button" onClick={() => notify("3 notifikasi belum dibaca")} aria-label="Buka notifikasi">
            <Bell size={20} /><span>3</span>
          </button>
        </div>
      </header>

      <MobileScroll className="app-screen">
        <main className={cx("screen-content", `screen-${screen}`)} data-testid="one-pro-app">
          {dataState === "loading" ? <div className="data-sync" role="status">Menyinkronkan data…</div> : null}
          {screen === "home" ? <Home role={role} setRole={setRole} go={go} previewMode={previewMode} workspace={workspace} /> : null}
          {screen === "agenda" ? <Agenda notify={notify} go={go} /> : null}
          {screen === "attendance" ? <AttendanceScreen notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} /> : null}
          {screen === "journal" ? <Journal notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} /> : null}
          {screen === "students" ? <Students notify={notify} workspace={workspace} refresh={refreshWorkspace} previewMode={previewMode} /> : null}
          {screen === "targets" ? <Targets notify={notify} /> : null}
          {screen === "reports" ? <Reports notify={notify} /> : null}
          {screen === "team" ? <Team notify={notify} workspace={workspace} role={role} previewMode={previewMode} /> : null}
          {screen === "admin" ? <Team notify={notify} workspace={workspace} role={role} previewMode={previewMode} superView /> : null}
          {screen === "chat" ? <Chat notify={notify} /> : null}
          {screen === "settings" ? <Settings dark={dark} setDark={setDark} notify={notify} onSignOut={() => supabase?.auth.signOut()} /> : null}
        </main>
      </MobileScroll>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        {navItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={cx(screen === item.id && "active")} onClick={() => go(item.id)}><Icon size={21} weight={screen === item.id ? "fill" : "regular"} /><span>{item.label}</span></button>;
        })}
        <button className={cx(menuOpen && "active")} onClick={() => setMenuOpen(true)}><Gear size={21} /><span>Lainnya</span></button>
      </nav>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Semua menu" description="Fitur One Pro sesuai akses akun Anda">
        <div className="menu-grid">
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => go(item.id)}><span className="menu-icon"><Icon size={21} /></span><span><strong>{item.label}</strong><small>{item.hint}</small></span><CaretRight size={16} /></button>;
          })}
        </div>
      </BottomSheet>

      {toast ? <div className="toast" role="status"><CheckCircle size={20} weight="fill" />{toast}</div> : null}
    </div>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div>;
}

function Home({ role, setRole, go, previewMode, workspace }: { role: Role; setRole: (role: Role) => void; go: (screen: Screen) => void; previewMode: boolean; workspace: WorkspaceData }) {
  return <>
    <div className="context-row">
      <div><span className="eyebrow">MALANG TIMUR</span><h1>{role === "Pengajar" ? "Kelas hari ini" : role === "PJ Kelompok" ? "Mangliawan Utara" : "Pantauan wilayah"}</h1></div>
      {previewMode ? <select value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Pratinjau peran">
        {(["Pengajar", "PJ Kelompok", "Admin Desa", "Admin Daerah", "Super Admin"] as Role[]).map((item) => <option key={item}>{item}</option>)}
      </select> : <span className="role-badge">{role}</span>}
    </div>

    {role === "Pengajar" || role === "PJ Kelompok" ? <OperationalHome go={go} workspace={workspace} previewMode={previewMode} /> : <MonitoringHome role={role} go={go} workspace={workspace} previewMode={previewMode} />}
  </>;
}

function OperationalHome({ go, workspace, previewMode }: { go: (screen: Screen) => void; workspace: WorkspaceData; previewMode: boolean }) {
  const activeStudents = previewMode ? 42 : workspace.students.filter((student) => student.status === "active").length;
  const scheduleCount = previewMode ? 3 : workspace.schedules.length;
  return <>
    <section className="focus-panel">
      <div className="focus-head"><div><span>HARI INI</span><strong>{scheduleCount} kelas</strong><small>{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</small></div><CalendarBlank size={27} /></div>
      <div className="schedule-list compact">
        <Schedule time="07.00" end="08.00" title="Tahsin Al-Qur'an" teacher="Ust. Ahmad Fauzi" status="Selesai" tone="success" />
        <Schedule time="16.00" end="17.30" title="Kelas Al-Fatihah" teacher="Ustaz Ahmad" status="Menunggu jurnal" tone="warning" action={() => go("journal")} />
        <Schedule time="18.30" end="19.30" title="Fiqih Dasar" teacher="Ustazah Siti" status="Akan dimulai" tone="neutral" />
      </div>
    </section>
    <section className="metric-strip" aria-label="Ringkasan kelompok">
      <Metric value={String(activeStudents)} label="Siswa aktif" />
      <Metric value="91%" label="Hadir bulan ini" />
      <Metric value="1" label="Laporan terlambat" warning />
    </section>
    <SectionTitle title="Perlu diselesaikan" action="Lihat semua" />
    <div className="action-list">
      <ActionRow icon={<ClipboardText />} title="Jurnal Kelas Al-Fatihah" meta="Batas pengisian pukul 20.00" badge="Segera" onClick={() => go("journal")} />
      <ActionRow icon={<Users />} title="Presensi belum lengkap" meta="2 siswa belum dipilih" onClick={() => go("attendance")} />
      <ActionRow icon={<ChartLineUp />} title="Tinjau progres individu" meta="6 anak memiliki catatan baru" onClick={() => go("reports")} />
    </div>
  </>;
}

function MonitoringHome({ role, go, workspace, previewMode }: { role: Role; go: (screen: Screen) => void; workspace: WorkspaceData; previewMode: boolean }) {
  const activeStudents = previewMode ? 486 : workspace.students.filter((student) => student.status === "active").length;
  const groupCount = previewMode ? 16 : workspace.groups.length;
  return <>
    <section className="progress-hero">
      <div><span>CAPAIAN TARGET</span><h2>78%</h2></div><div className="progress-copy"><strong>September 2026</strong><small>Naik 6% dari Agustus</small></div>
      <div className="progress-track"><span style={{ width: "78%" }} /></div>
    </section>
    <section className="metric-strip"><Metric value={String(activeStudents)} label="Siswa aktif" /><Metric value="88%" label="Kehadiran" /><Metric value={String(groupCount)} label="Kelompok" /></section>
    <SectionTitle title="Progres per desa" action="Lihat wilayah" />
    <div className="village-list">
      <Village rank="01" name="Mangliawan" attendance="92%" progress="88%" status="Sangat baik" />
      <Village rank="02" name="Sawojajar" attendance="86%" progress="76%" status="Baik" />
      <Village rank="03" name="Cibuni" attendance="78%" progress="62%" status="Perlu perhatian" warning />
    </div>
    <SectionTitle title="Perlu ditindaklanjuti" />
    <div className="action-list">
      <ActionRow icon={<ClipboardText />} title="Jurnal belum lengkap" meta="24 jurnal dari 7 kelompok" badge="24" onClick={() => go("journal")} />
      <ActionRow icon={<Student />} title="Perkembangan perlu tinjauan" meta="12 anak berdasarkan data terakhir" badge="12" onClick={() => go("reports")} />
      {role === "Super Admin" ? <ActionRow icon={<UserCircle />} title="Aktivitas akun" meta="38 login hari ini • 2 gagal" onClick={() => go("team")} /> : null}
    </div>
  </>;
}

function Schedule({ time, end, title, teacher, status, tone, action }: { time: string; end: string; title: string; teacher: string; status: string; tone: string; action?: () => void }) {
  return <button className="schedule-row" onClick={action}><span className="schedule-time"><strong>{time}</strong><small>{end}</small></span><span className="schedule-info"><strong>{title}</strong><small>{teacher}</small></span><span className={cx("status", tone)}>{status}</span>{action ? <CaretRight size={15} /> : null}</button>;
}

function Metric({ value, label, warning }: { value: string; label: string; warning?: boolean }) {
  return <div className={cx("metric", warning && "warning")}><strong>{value}</strong><span>{label}</span></div>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return <div className="section-title"><h2>{title}</h2>{action ? <button>{action}<CaretRight size={14} /></button> : null}</div>;
}

function ActionRow({ icon, title, meta, badge, onClick }: { icon: React.ReactNode; title: string; meta: string; badge?: string; onClick?: () => void }) {
  return <button className="action-row" onClick={onClick}><span className="action-icon">{icon}</span><span><strong>{title}</strong><small>{meta}</small></span>{badge ? <b>{badge}</b> : <CaretRight size={17} />}</button>;
}

function Village({ rank, name, attendance, progress, status, warning }: { rank: string; name: string; attendance: string; progress: string; status: string; warning?: boolean }) {
  return <button className="village-row"><span className="rank">{rank}</span><span className="village-main"><strong>{name}</strong><small>Kehadiran {attendance} · Target {progress}</small></span><span className={cx("status", warning ? "warning" : "success")}>{status}</span><CaretRight size={16} /></button>;
}

function Agenda({ notify, go }: { notify: (message: string) => void; go: (screen: Screen) => void }) {
  const [activeDay, setActiveDay] = useState(14);
  return <>
    <PageHeader title="Jadwal Mengaji" subtitle="Semua kelas di Mangliawan Utara" action={<button className="primary-icon" onClick={() => notify("Form jadwal baru dibuka")}><Plus size={20} /></button>} />
    <div className="day-picker">{[13,14,15,16,17,18,19].map((day, index) => <button key={day} className={cx(activeDay === day && "active")} onClick={() => setActiveDay(day)}><small>{["Min","Sen","Sel","Rab","Kam","Jum","Sab"][index]}</small><strong>{day}</strong></button>)}</div>
    <SectionTitle title={activeDay === 14 ? "3 kelas hari ini" : "Belum ada jadwal"} />
    {activeDay === 14 ? <div className="schedule-list card-list">
      <Schedule time="07.00" end="08.00" title="Tahsin Al-Qur'an" teacher="Ust. Ahmad Fauzi" status="Selesai" tone="success" />
      <Schedule time="16.00" end="17.30" title="Kelas Al-Fatihah" teacher="Ustaz Ahmad" status="Menunggu jurnal" tone="warning" action={() => go("journal")} />
      <Schedule time="18.30" end="19.30" title="Fiqih Dasar" teacher="Ustazah Siti" status="Akan dimulai" tone="neutral" />
    </div> : <EmptyState icon={<CalendarBlank size={30} />} title="Belum ada jadwal" text="Tambahkan agenda atau pilih tanggal lain." />}
    <button className="secondary-button" onClick={() => notify("Jadwal rutin berhasil dibuat untuk 4 minggu")}>Buat jadwal rutin</button>
  </>;
}

function AttendanceScreen({ notify, workspace, userId, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; userId?: string; previewMode: boolean }) {
  const [classId, setClassId] = useState(workspace.classes[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<Record<string, Attendance>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!classId && workspace.classes[0]) setClassId(workspace.classes[0].id); }, [classId, workspace.classes]);
  const selectedClass = workspace.classes.find((item) => item.id === classId);
  const enrolledIds = new Set(workspace.enrollments.filter((item) => item.class_id === classId).map((item) => item.student_id));
  const liveStudents = previewMode ? demoStudents.filter((student) => student.active).map((student) => ({ id: String(student.id), full_name: student.name, school_grade: student.grade === "PAUD" ? 0 : Number(student.grade.match(/\d/)?.[0] ?? 1) })) : workspace.students.filter((student) => student.status === "active" && (enrolledIds.size ? enrolledIds.has(student.id) : student.group_id === selectedClass?.group_id));
  const save = async () => {
    if (previewMode) { notify(`Presensi ${Object.keys(records).length} siswa siap disimpan`); return; }
    if (!classId || !userId || liveStudents.some((student) => !records[student.id])) { notify("Pilih kelas dan isi status semua anak terlebih dahulu"); return; }
    setSaving(true);
    try {
      await saveAttendance({ classId, date, userId, records: liveStudents.map((student) => ({ studentId: student.id, status: records[student.id] === "H" ? "hadir" : records[student.id] === "I" ? "izin" : "alpha" })) });
      notify(`Presensi ${liveStudents.length} siswa berhasil disimpan`);
    } catch (error) { notify(error instanceof Error ? error.message : "Presensi gagal disimpan"); }
    finally { setSaving(false); }
  };
  return <>
    <PageHeader title="Isi Presensi" subtitle="Riwayat anak nonaktif tetap tersimpan" />
    <div className="attendance-controls"><label className="field"><span>Kelas pengajian</span><select value={classId} onChange={(event) => { setClassId(event.target.value); setRecords({}); }}>{previewMode ? <option value="demo">Kelas Al-Fatihah</option> : workspace.classes.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Tanggal</span><KeyboardInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
    <div className="summary-line"><span><Clock size={17} />{selectedClass?.name ?? "Pilih kelas"}</span><span>{Object.keys(records).length}/{liveStudents.length} terisi</span></div>
    {liveStudents.length ? <div className="attendance-list">{liveStudents.map((student) => <div className="attendance-row" key={student.id}><Avatar initials={initialsFor(student.full_name)} /><span><strong>{student.full_name}</strong><small>{gradeLabel(student.school_grade)}</small></span><div className="attendance-options">{(["H","I","A"] as Attendance[]).map((status) => <button key={status} className={cx(records[student.id] === status && "active", status === "A" && "absent")} onClick={() => setRecords((value) => ({...value,[student.id]:status}))}>{status}</button>)}</div></div>)}</div> : <EmptyState icon={<Users size={30} />} title="Belum ada anak di kelas" text="Masukkan anak melalui pembagian kelas sebelum mengisi presensi." />}
    <div className="legend"><span><i className="h" />Hadir</span><span><i className="i" />Izin</span><span><i className="a" />Alfa</span></div>
    <button className="primary-button" disabled={saving || !liveStudents.length} onClick={() => void save()}><Check size={18} />{saving ? "Menyimpan…" : "Simpan presensi"}</button>
  </>;
}

function Journal({ notify, workspace, userId, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; userId?: string; previewMode: boolean }) {
  const [progress, setProgress] = useState(false);
  const [classId, setClassId] = useState(workspace.classes[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startedAt, setStartedAt] = useState("16:00");
  const [endedAt, setEndedAt] = useState("17:30");
  const [material, setMaterial] = useState("");
  const [achievement, setAchievement] = useState("");
  const [obstacles, setObstacles] = useState("");
  const [improvementPlan, setImprovementPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!classId && workspace.classes[0]) setClassId(workspace.classes[0].id); }, [classId, workspace.classes]);
  const submit = async () => {
    if (previewMode) { notify("Jurnal siap disimpan pada mode data nyata"); return; }
    if (!classId || !userId || !material.trim()) { notify("Kelas dan materi wajib diisi"); return; }
    setSaving(true);
    try { await saveDailyJournal({ classId, userId, date, startedAt, endedAt, material, achievement, obstacles, improvementPlan, notes }); notify("Jurnal berhasil disimpan dan rekap diperbarui"); }
    catch (error) { notify(error instanceof Error ? error.message : "Jurnal gagal disimpan"); }
    finally { setSaving(false); }
  };
  return <>
    <PageHeader title="Jurnal Harian" subtitle="Data jurnal menjadi sumber rekap bulanan dan laporan individu" />
    <section className="data-card form-card">
      <div className="form-grid two"><label className="field"><span>Kelas</span><select value={classId} onChange={(event) => setClassId(event.target.value)}>{previewMode ? <option value="demo">Kelas Al-Fatihah</option> : workspace.classes.filter((item) => item.is_active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Tanggal</span><KeyboardInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
      <div className="form-grid two"><label className="field"><span>Jam mulai</span><KeyboardInput type="time" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label><label className="field"><span>Jam selesai</span><KeyboardInput type="time" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} /></label></div>
      <label className="field"><span>Materi yang disampaikan</span><KeyboardTextarea value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Tuliskan materi hari ini" rows={3} /></label>
      <label className="field"><span>Pencapaian</span><KeyboardTextarea value={achievement} onChange={(event) => setAchievement(event.target.value)} placeholder="Capaian pembelajaran hari ini" rows={2} /></label>
      <label className="field"><span>Keluhan atau kendala</span><KeyboardTextarea value={obstacles} onChange={(event) => setObstacles(event.target.value)} placeholder="Kendala yang ditemukan" rows={2} /></label>
      <label className="field"><span>Saran pembenahan berikutnya</span><KeyboardTextarea value={improvementPlan} onChange={(event) => setImprovementPlan(event.target.value)} placeholder="Langkah perbaikan pertemuan berikutnya" rows={2} /></label>
      <label className="field"><span>Catatan tambahan</span><KeyboardTextarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan lain bila ada" rows={2} /></label>
      <label className="switch-row"><span><strong>Catat progres individu</strong><small>Opsional, pilih hanya anak yang diamati</small></span><button className={cx("switch", progress && "on")} onClick={() => setProgress((value) => !value)} aria-label="Catat progres individu"><span /></button></label>
      {progress ? <div className="progress-entry"><div className="student-mini"><Avatar initials="AF" /><span><strong>Ahmad Fauzan</strong><small>Target: Mengenal huruf hijaiyah</small></span></div><div className="chip-row">{["Mulai","Berkembang","Perlu penguatan","Tercapai"].map((item, index) => <button key={item} className={cx(index === 1 && "active")}>{item}</button>)}</div><TextArea label="Catatan pengamatan" placeholder="Contoh: masih tertukar huruf ba dan ta" /></div> : null}
    </section>
    <button className="primary-button" disabled={saving} onClick={() => void submit()}><Check size={18} />{saving ? "Menyimpan…" : "Simpan jurnal"}</button>
  </>;
}

function Students({ notify, workspace, refresh, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; refresh: () => Promise<void>; previewMode: boolean }) {
  const [showPhotos, setShowPhotos] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<WorkspaceStudent | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const liveStudents = previewMode ? demoStudents.map((student) => ({ id: String(student.id), group_id: "demo", full_name: student.name, nickname: null, birth_place: null, birth_date: null, address: null, phone: null, father_name: null, mother_name: null, father_phone: null, mother_phone: null, school_grade: student.grade === "PAUD" ? 0 : Number(student.grade.match(/\d/)?.[0] ?? 1), photo_path: null, show_photo: true, status: student.active ? "active" as const : "inactive" as const })) : workspace.students;
  const filtered = useMemo(() => liveStudents.filter((student) => student.full_name.toLowerCase().includes(query.toLowerCase())), [liveStudents, query]);
  const activeCount = liveStudents.filter((student) => student.status === "active").length;
  const inactiveCount = liveStudents.filter((student) => student.status !== "active").length;
  return <>
    <PageHeader title="Database Anak" subtitle={`${activeCount} aktif • ${inactiveCount} nonaktif`} action={<button className="primary-icon" onClick={() => setEditing("new")} aria-label="Tambah anak"><Plus size={20} /></button>} />
    <div className="toolbar"><label className="search"><MagnifyingGlass size={17} /><KeyboardInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama anak" /></label><button className={cx("photo-toggle", showPhotos && "active")} onClick={() => setShowPhotos((value) => !value)}><UserCircle size={18} />Foto</button></div>
    {filtered.length ? <div className="student-list">{filtered.map((student) => <button className="student-row" key={student.id} onClick={() => setEditing(student)}>{showPhotos && student.show_photo ? <Avatar initials={initialsFor(student.full_name)} muted={student.status !== "active"} /> : null}<span><strong>{student.full_name}</strong><small>{gradeLabel(student.school_grade)} • {student.status === "active" ? "Aktif" : "Nonaktif — riwayat tetap tersimpan"}</small></span><PencilSimple size={17} /></button>)}</div> : <EmptyState icon={<Student size={30} />} title="Belum ada data anak" text="Tambahkan anak atau impor data Excel." />}
    <div className="split-actions"><button className="secondary-button" onClick={() => notify("Template Excel siap diunduh")}><DownloadSimple size={17} />Template</button><button className="secondary-button" onClick={() => notify("Pilih file Excel untuk diimpor")}><UploadSimple size={17} />Import</button></div>
    {editing ? <StudentEditor student={editing === "new" ? null : editing} groups={workspace.groups} saving={saving} onClose={() => setEditing(null)} onSave={async (values) => {
      if (previewMode) { notify("Mode pratinjau: data tidak disimpan"); setEditing(null); return; }
      setSaving(true);
      try { await saveStudent(values); await refresh(); notify("Data anak berhasil disimpan"); setEditing(null); }
      catch (error) { notify(error instanceof Error ? error.message : "Data anak gagal disimpan"); }
      finally { setSaving(false); }
    }} onDeactivate={async (student) => {
      if (previewMode) { notify("Mode pratinjau: status tidak diubah"); return; }
      setSaving(true);
      try { await setStudentStatus(student.id, student.status === "active" ? "inactive" : "active"); await refresh(); notify(student.status === "active" ? "Anak dinonaktifkan; riwayat presensi tetap aman" : "Anak diaktifkan kembali"); setEditing(null); }
      catch (error) { notify(error instanceof Error ? error.message : "Status gagal diubah"); }
      finally { setSaving(false); }
    }} /> : null}
  </>;
}

function StudentEditor({ student, groups, saving, onClose, onSave, onDeactivate }: { student: WorkspaceStudent | null; groups: WorkspaceData["groups"]; saving: boolean; onClose: () => void; onSave: (student: Partial<WorkspaceStudent> & Pick<WorkspaceStudent, "group_id" | "full_name">) => Promise<void>; onDeactivate: (student: WorkspaceStudent) => Promise<void> }) {
  const [form, setForm] = useState(() => ({
    group_id: student?.group_id ?? groups[0]?.id ?? "",
    full_name: student?.full_name ?? "",
    nickname: student?.nickname ?? "",
    birth_place: student?.birth_place ?? "",
    birth_date: student?.birth_date ?? "",
    address: student?.address ?? "",
    phone: student?.phone ?? "",
    father_name: student?.father_name ?? "",
    mother_name: student?.mother_name ?? "",
    father_phone: student?.father_phone ?? "",
    mother_phone: student?.mother_phone ?? "",
    school_grade: student?.school_grade ?? 0,
    show_photo: student?.show_photo ?? false,
  }));
  const field = (key: keyof typeof form, value: string | number | boolean) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="editor-overlay" role="dialog" aria-modal="true" aria-label={student ? "Edit anak" : "Tambah anak"}>
    <section className="editor-panel">
      <div className="editor-head"><div><span className="eyebrow">DATABASE ANAK</span><h2>{student ? "Edit data" : "Tambah anak"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={19} /></button></div>
      <div className="editor-grid">
        <label className="field"><span>Kelompok</span><select value={form.group_id} onChange={(event) => field("group_id", event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label className="field"><span>Nama lengkap</span><KeyboardInput value={form.full_name} onChange={(event) => field("full_name", event.target.value)} /></label>
        <label className="field"><span>Nama panggilan</span><KeyboardInput value={form.nickname} onChange={(event) => field("nickname", event.target.value)} /></label>
        <label className="field"><span>Jenjang sekolah</span><select value={form.school_grade} onChange={(event) => field("school_grade", Number(event.target.value))}>{[0,1,2,3,4,5,6].map((grade) => <option key={grade} value={grade}>{gradeLabel(grade)}</option>)}</select></label>
        <label className="field"><span>Tempat lahir</span><KeyboardInput value={form.birth_place} onChange={(event) => field("birth_place", event.target.value)} /></label>
        <label className="field"><span>Tanggal lahir</span><KeyboardInput type="date" value={form.birth_date} onChange={(event) => field("birth_date", event.target.value)} /></label>
        <label className="field editor-wide"><span>Alamat rumah</span><KeyboardTextarea value={form.address} onChange={(event) => field("address", event.target.value)} rows={2} /></label>
        <label className="field"><span>Nomor HP anak</span><KeyboardInput value={form.phone} onChange={(event) => field("phone", event.target.value)} /></label>
        <label className="field"><span>Nama ayah</span><KeyboardInput value={form.father_name} onChange={(event) => field("father_name", event.target.value)} /></label>
        <label className="field"><span>WhatsApp ayah</span><KeyboardInput value={form.father_phone} onChange={(event) => field("father_phone", event.target.value)} /></label>
        <label className="field"><span>Nama ibu</span><KeyboardInput value={form.mother_name} onChange={(event) => field("mother_name", event.target.value)} /></label>
        <label className="field"><span>WhatsApp ibu</span><KeyboardInput value={form.mother_phone} onChange={(event) => field("mother_phone", event.target.value)} /></label>
        <label className="switch-row editor-wide"><span><strong>Tampilkan foto anak</strong><small>Foto tetap opsional dan dapat disembunyikan</small></span><button type="button" className={cx("switch", form.show_photo && "on")} onClick={() => field("show_photo", !form.show_photo)}><span /></button></label>
      </div>
      <div className="editor-actions">{student ? <button className="danger-button" disabled={saving} onClick={() => void onDeactivate(student)}>{student.status === "active" ? "Nonaktifkan" : "Aktifkan kembali"}</button> : null}<button className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={saving || !form.group_id || !form.full_name.trim()} onClick={() => void onSave({ ...form, id: student?.id, status: student?.status ?? "active" })}>{saving ? "Menyimpan…" : "Simpan data"}</button></div>
    </section>
  </div>;
}

function initialsFor(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function gradeLabel(grade: number | null) { return grade === 0 ? "PAUD" : grade ? `Kelas ${grade} SD` : "Jenjang belum diisi"; }

function Targets({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageHeader title="Target Pembelajaran" subtitle="Dikelola Daerah Malang Timur" action={<button className="primary-icon" onClick={() => notify("Form target baru dibuka")}><Plus size={20} /></button>} />
    <div className="filter-pills"><button className="active">Semua</button><button>PAUD</button><button>Kelas 1</button><button>Kelas 2–6</button></div>
    <div className="target-list">
      <TargetRow grade="PAUD" title="Doa harian dasar" count="3 indikator" progress="81%" />
      <TargetRow grade="Kelas 1 SD" title="Mengenal huruf hijaiyah" count="5 indikator" progress="76%" />
      <TargetRow grade="Kelas 2 SD" title="Kelancaran membaca Iqra" count="4 indikator" progress="68%" />
      <TargetRow grade="Kelas 3–6 SD" title="Tahsin dan tajwid dasar" count="8 indikator" progress="72%" />
    </div>
    <button className="secondary-button" onClick={() => notify("Template target Excel siap diunduh")}><UploadSimple size={17} />Import target Excel</button>
  </>;
}

function TargetRow({ grade, title, count, progress }: { grade: string; title: string; count: string; progress: string }) {
  return <button className="target-row"><span className="target-icon"><Target size={20} /></span><span><small>{grade}</small><strong>{title}</strong><em>{count}</em></span><b>{progress}</b><CaretRight size={16} /></button>;
}

function Reports({ notify }: { notify: (message: string) => void }) {
  const [tab, setTab] = useState<"individual" | "class">("individual");
  return <>
    <PageHeader title="Laporan" subtitle="Perkembangan dan rekap pembelajaran" />
    <div className="segmented"><button className={cx(tab === "individual" && "active")} onClick={() => setTab("individual")}>Individu</button><button className={cx(tab === "class" && "active")} onClick={() => setTab("class")}>Kelas & PPT</button></div>
    {tab === "individual" ? <>
      <section className="student-report data-card"><div className="student-mini"><Avatar initials="AF" /><span><strong>Ahmad Fauzan</strong><small>Kelas Al-Fatihah • Kelas 1 SD</small></span></div><div className="report-stats"><Metric value="92%" label="Kehadiran" /><Metric value="68%" label="Capaian" /><Metric value="6" label="Catatan" /></div><div className="ai-note"><ChartLineUp size={21} /><span><strong>Analisis terbaru</strong><p>Progres meningkat pada 3 pertemuan terakhir. Perlu penguatan pada huruf yang memiliki bentuk serupa.</p><small>Berdasarkan 8 jurnal • 14 September 2026</small></span></div></section>
      <button className="primary-button" onClick={() => notify("Laporan individu sedang disiapkan")}><DownloadSimple size={18} />Unduh PDF / Word</button>
    </> : <>
      <section className="upload-card"><FilePpt size={34} /><h2>Template PowerPoint kelas</h2><p>Unggah PPTX, periksa pemetaan data, lalu web mengisi laporan dari data yang telah dianalisis.</p><button className="secondary-button" onClick={() => notify("Pilih template PPTX kelas")}><UploadSimple size={17} />Unggah template PPTX</button></section>
      <div className="action-list"><ActionRow icon={<FilePpt />} title="Kelas Al-Fatihah" meta="Template aktif • diperbarui 10 Sep" badge="Siap" /><ActionRow icon={<WarningCircle />} title="Kelas Fiqih Dasar" meta="Belum memiliki template" badge="Atur" /></div>
    </>}
  </>;
}

const roleLabels: Record<AccountRole, string> = { super_admin: "Super Admin", admin_daerah: "Admin Daerah", admin_desa: "Admin Desa", pj_kelompok: "PJ Kelompok", pengajar: "Dewan Guru / Pengajar" };

function Team({ notify, workspace, role, previewMode, superView = false }: { notify: (message: string) => void; workspace: WorkspaceData; role: Role; previewMode: boolean; superView?: boolean }) {
  const [accounts, setAccounts] = useState<WorkspaceAccount[]>([]);
  const [activity, setActivity] = useState<LoginActivity[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceAccount | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountRole, setAccountRole] = useState<AccountRole>(role === "PJ Kelompok" ? "pengajar" : role === "Admin Desa" ? "pj_kelompok" : role === "Admin Daerah" ? "admin_desa" : "admin_daerah");
  const [areaId, setAreaId] = useState(workspace.areas[0]?.id ?? "");
  const [villageId, setVillageId] = useState(workspace.villages[0]?.id ?? "");
  const [groupId, setGroupId] = useState(workspace.groups[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const canCreate = role !== "Pengajar";
  const availableRoles: AccountRole[] = role === "Super Admin" ? ["admin_daerah", "admin_desa", "pj_kelompok", "pengajar"] : role === "Admin Daerah" ? ["admin_desa", "pj_kelompok", "pengajar"] : role === "Admin Desa" ? ["pj_kelompok", "pengajar"] : ["pengajar"];
  const visibleVillages = workspace.villages.filter((village) => !areaId || village.area_id === areaId);
  const visibleGroups = workspace.groups.filter((group) => !villageId || group.village_id === villageId);

  const refreshAccounts = async () => {
    if (previewMode) {
      setAccounts([{ membership_id: "demo", user_id: "demo", role: "pengajar", area_id: null, village_id: null, group_id: workspace.groups[0]?.id ?? null, is_active: true, username: "guru.demo", full_name: "Siti Fatimah", last_login_at: new Date().toISOString() }]);
      return;
    }
    try { const result = await loadAccounts(); setAccounts(result.accounts); setActivity(result.activity); }
    catch (error) { notify(error instanceof Error ? error.message : "Data akun gagal dimuat"); }
  };

  useEffect(() => { void refreshAccounts(); }, [previewMode]);
  useEffect(() => { if (!areaId && workspace.areas[0]) setAreaId(workspace.areas[0].id); }, [areaId, workspace.areas]);
  useEffect(() => { if ((!villageId || !visibleVillages.some((item) => item.id === villageId)) && visibleVillages[0]) setVillageId(visibleVillages[0].id); }, [villageId, visibleVillages]);
  useEffect(() => { if ((!groupId || !visibleGroups.some((item) => item.id === groupId)) && visibleGroups[0]) setGroupId(visibleGroups[0].id); }, [groupId, visibleGroups]);

  const openCreate = () => { setEditing(null); setFullName(""); setUsername(""); setPassword(""); setAccountRole(availableRoles[0]); setOpen(true); };
  const openEdit = (account: WorkspaceAccount) => { setEditing(account); setFullName(account.full_name); setUsername(account.username ?? ""); setPassword(""); setOpen(true); };
  const submit = async () => {
    if (previewMode) { notify(editing ? "Perubahan akun siap disimpan" : "Akun baru siap dibuat"); setOpen(false); return; }
    setSaving(true);
    try {
      await manageAccount(editing ? { action: "update", userId: editing.user_id, fullName, username, password } : {
        action: "create", fullName, username, password, role: accountRole,
        areaId: accountRole === "admin_daerah" ? areaId : null,
        villageId: accountRole === "admin_desa" ? villageId : null,
        groupId: ["pj_kelompok", "pengajar"].includes(accountRole) ? groupId : null,
      });
      notify(editing ? "Data login berhasil diperbarui" : "User baru berhasil dibuat");
      setOpen(false);
      await refreshAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Akun gagal disimpan"); }
    finally { setSaving(false); }
  };
  const setStatus = async (account: WorkspaceAccount) => {
    if (previewMode) { notify("Status akun siap diubah"); return; }
    try { await manageAccount({ action: "status", userId: account.user_id, active: !account.is_active }); notify(account.is_active ? "Akun dinonaktifkan" : "Akun diaktifkan"); await refreshAccounts(); }
    catch (error) { notify(error instanceof Error ? error.message : "Status gagal diubah"); }
  };
  const remove = async (account: WorkspaceAccount) => {
    if (!window.confirm(`Hapus akun ${account.full_name}? Data login dan aksesnya akan dihapus permanen.`)) return;
    if (previewMode) { notify("Akun contoh tidak dihapus"); return; }
    try { await manageAccount({ action: "delete", userId: account.user_id }); notify("Akun berhasil dihapus"); await refreshAccounts(); }
    catch (error) { notify(error instanceof Error ? error.message : "Akun gagal dihapus"); }
  };
  const scopeName = (account: WorkspaceAccount) => workspace.groups.find((item) => item.id === account.group_id)?.name ?? workspace.villages.find((item) => item.id === account.village_id)?.name ?? workspace.areas.find((item) => item.id === account.area_id)?.name ?? "Seluruh sistem";
  const shownAccounts = superView ? accounts : accounts.filter((account) => account.role !== "super_admin");

  return <>
    <PageHeader title={superView ? "Super Admin" : "Tim & Akses"} subtitle={superView ? "Kontrol user, tingkatan akses, status, dan riwayat login" : "Kelola anggota yang berada dalam lingkup Anda"} action={canCreate ? <button className="primary-icon" onClick={openCreate} aria-label="Tambah user"><Plus size={20} /></button> : undefined} />
    <section className="metric-strip"><Metric value={String(shownAccounts.length)} label="Total user" /><Metric value={String(shownAccounts.filter((item) => item.is_active).length)} label="Aktif" /><Metric value={String(shownAccounts.filter((item) => !item.is_active).length)} label="Nonaktif" /></section>
    <div className="team-list">{shownAccounts.length ? shownAccounts.map((account) => <Member key={account.membership_id} account={account} scope={scopeName(account)} onEdit={() => openEdit(account)} onStatus={() => void setStatus(account)} onDelete={() => void remove(account)} />) : <EmptyState icon={<Users size={30} />} title="Belum ada anggota" text="Tekan tombol tambah untuk membuat username dan password baru." />}</div>
    {superView ? <><SectionTitle title="Riwayat aktivitas akun" /><div className="timeline">{activity.length ? activity.map((item) => <p key={item.id}><i />{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at))} <strong>{accounts.find((account) => account.user_id === item.actor_id)?.full_name ?? "Sistem"}</strong> {item.action === "user_login" ? "login" : item.action.replaceAll("_", " ")}</p>) : <p>Belum ada aktivitas login yang tercatat.</p>}</div></> : null}
    {open ? <div className="editor-overlay" role="dialog" aria-modal="true" aria-label={editing ? "Edit user" : "Tambah user"}><section className="editor-panel account-panel"><div className="editor-head"><div><span className="eyebrow">{editing ? "EDIT LOGIN" : "USER BARU"}</span><h2>{editing ? editing.full_name : "Buat akun langsung"}</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Tutup"><X size={19} /></button></div>
      <label className="field"><span>Nama lengkap</span><KeyboardInput value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
      <label className="field"><span>Username</span><KeyboardInput value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} /></label>
      <label className="field"><span>{editing ? "Password baru (kosongkan jika tetap)" : "Password awal"}</span><KeyboardInput value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" /></label>
      {!editing ? <><label className="field"><span>Tingkatan akses</span><select value={accountRole} onChange={(event) => setAccountRole(event.target.value as AccountRole)}>{availableRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
        {accountRole === "admin_daerah" ? <label className="field"><span>Daerah</span><select value={areaId} onChange={(event) => setAreaId(event.target.value)}>{workspace.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
        {accountRole === "admin_desa" ? <><label className="field"><span>Daerah</span><select value={areaId} onChange={(event) => setAreaId(event.target.value)}>{workspace.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Desa</span><select value={villageId} onChange={(event) => setVillageId(event.target.value)}>{visibleVillages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></> : null}
        {["pj_kelompok", "pengajar"].includes(accountRole) ? <><label className="field"><span>Desa</span><select value={villageId} onChange={(event) => setVillageId(event.target.value)}>{visibleVillages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Kelompok</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)}>{visibleGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></> : null}</> : <div className="account-scope-note"><strong>{roleLabels[editing.role]}</strong><span>{scopeName(editing)}</span></div>}
      <button className="primary-button" disabled={saving || !fullName.trim() || !username.trim() || (!editing && password.length < 8)} onClick={() => void submit()}>{saving ? "Menyimpan…" : editing ? "Simpan perubahan" : "Buat user"}</button>
    </section></div> : null}
  </>;
}

function Member({ account, scope, onEdit, onStatus, onDelete }: { account: WorkspaceAccount; scope: string; onEdit: () => void; onStatus: () => void; onDelete: () => void }) {
  const initials = account.full_name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const lastLogin = account.last_login_at ? `Login ${new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(account.last_login_at))}` : "Belum pernah login";
  return <article className="member-card"><Avatar initials={initials || "U"} muted={!account.is_active} /><span className="member-main"><strong>{account.full_name}</strong><small>@{account.username ?? "belum-diatur"} • {roleLabels[account.role]}</small><em>{scope} • {lastLogin}</em></span><span className={cx("status", account.is_active ? "success" : "warning")}>{account.is_active ? "Aktif" : "Nonaktif"}</span>{account.role !== "super_admin" ? <div className="member-actions"><button onClick={onEdit} aria-label={`Edit ${account.full_name}`}><PencilSimple size={16} /></button><button onClick={onStatus}>{account.is_active ? "Nonaktifkan" : "Aktifkan"}</button><button className="danger" onClick={onDelete} aria-label={`Hapus ${account.full_name}`}><Trash size={16} /></button></div> : null}</article>;
}

function Chat({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageHeader title="Komunikasi" subtitle="Daerah, desa, dan kelompok" action={<button className="primary-icon"><Plus size={20} /></button>} />
    <div className="filter-pills"><button className="active">Semua</button><button>Daerah</button><button>Desa</button><button>Kelompok</button></div>
    <div className="chat-list"><ChatRow initials="MT" title="Daerah Malang Timur" message="Mohon lengkapi jurnal bulanan sebelum Jumat." time="19.12" unread="2" /><ChatRow initials="DM" title="Desa Mangliawan" message="Jadwal musyawarah sudah diperbarui." time="17.30" /><ChatRow initials="ZS" title="Kelompok Zam Zam" message="Baik, laporan sudah kami terima." time="Kemarin" /></div>
    <button className="secondary-button" onClick={() => notify("Pengumuman baru dapat dibuat")}>Buat pengumuman penting</button>
  </>;
}

function ChatRow({ initials, title, message, time, unread }: { initials: string; title: string; message: string; time: string; unread?: string }) {
  return <button className="chat-row"><Avatar initials={initials} /><span><strong>{title}</strong><small>{message}</small></span><em>{time}{unread ? <b>{unread}</b> : null}</em></button>;
}

function Settings({ dark, setDark, notify, onSignOut }: { dark: boolean; setDark: (value: boolean) => void; notify: (message: string) => void; onSignOut: () => void }) {
  return <>
    <PageHeader title="Pengaturan" subtitle="Akun dan sistem One Pro" />
    <section className="data-card settings-card"><label className="switch-row"><span><strong>Mode gelap</strong><small>Sesuaikan kenyamanan tampilan</small></span><button className={cx("switch", dark && "on")} onClick={() => setDark(!dark)}><span /></button></label><ActionRow icon={<Bell />} title="Notifikasi HP" meta="Jadwal dan pengingat pukul 20.00" badge="Aktif" /><ActionRow icon={<Gear />} title="Gemini AI" meta="3 API key • rotasi otomatis" badge="Admin" /><ActionRow icon={<Database />} title="Penyimpanan" meta="Foto anak dan template PPTX" /></section>
    <button className="danger-button" onClick={() => { onSignOut(); notify("Anda berhasil keluar dari akun"); }}><SignOut size={18} />Keluar akun</button>
  </>;
}

function AuthScreen({ ready, externalMessage, clearExternalMessage }: { ready: boolean; externalMessage: string | null; clearExternalMessage: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const username = identifier.trim().toLowerCase();
    if (username.includes("@")) { setMessage("Masukkan username, bukan alamat email."); return; }
    if (!supabase || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 8) {
      setMessage("Masukkan username yang benar dan password minimal 8 karakter.");
      return;
    }
    clearExternalMessage();
    setLoading(true);
    setMessage(null);
    const result = await supabase.auth.signInWithPassword({ email: `${username}@accounts.onepro.local`, password });
    setLoading(false);
    if (result.error) setMessage("Username atau password salah.");
  };

  return <main className="auth-screen">
    <section className="auth-brand"><span className="auth-logo" /><div><strong>One Pro</strong><small>Jurnal Digital</small></div></section>
    <section className="auth-card">
      <span className="eyebrow">MALANG TIMUR</span>
      <h1>Masuk</h1>
      <p>Masuk dengan username dan password yang dibuat oleh pengelola.</p>
      {!ready ? <div className="auth-loading">Memeriksa sesi…</div> : <>
        <label className="auth-field"><span>Username</span><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoCapitalize="none" spellCheck={false} autoComplete="username" placeholder="contoh: superadmin" /></label>
        <label className="auth-field"><span>Password</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
        {message || externalMessage ? <div className="auth-message" role="status">{message ?? externalMessage}</div> : null}
        <button className="primary-button" disabled={loading} onClick={submit}>{loading ? "Memeriksa akun…" : "Masuk"}</button>
        <div className="auth-help">Tidak menggunakan email atau tautan undangan.</div>
      </>}
    </section>
  </main>;
}

function Field({ label, value }: { label: string; value?: string }) { return <label className="field"><span>{label}</span><KeyboardInput defaultValue={value} /></label>; }
function TextArea({ label, placeholder }: { label: string; placeholder: string }) { return <label className="field"><span>{label}</span><KeyboardTextarea placeholder={placeholder} rows={3} /></label>; }
function Avatar({ initials, muted }: { initials: string; muted?: boolean }) { return <span className={cx("avatar", muted && "muted")}>{initials}</span>; }
function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state">{icon}<strong>{title}</strong><p>{text}</p></div>; }
