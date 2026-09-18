import { useEffect, useMemo, useState } from "react";
import "@fontsource-variable/plus-jakarta-sans";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { createChatThread, deleteSchedule, deleteTarget, emptyWorkspace, loadAccounts, loadAttendanceSummary, loadChat, loadTargets, loadWorkspace, manageAccount, saveAttendance, saveClass, saveDailyJournal, saveSchedule, saveStudent, saveTarget, sendChatMessage, setStudentStatus, type AccountRole, type ChatMessage, type ChatThread, type LoginActivity, type WorkspaceAccount, type WorkspaceData, type WorkspaceStudent, type WorkspaceTarget } from "./lib/data";
import {
  ArrowLeft,
  Bell,
  Buildings,
  ChatCircleDots,
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
  List,
  MagnifyingGlass,
  Moon,
  PaperPlaneTilt,
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
import { JournalWorkspace, MonthlyAiAnalysis, TeacherClassAssignmentPanel } from "./journal-workspace";
import { AttendanceWorkspace, PptTemplateManager, StudentDatabaseHub } from "./operations-workspace";
import { ProfessionalWordReport } from "./word-report";
import { ProfessionalPptReport } from "./ppt-report";
import { RegionalJournalMonitor, RegionalMonitoringHome, RegionStructureManager } from "./region-monitoring";

type Screen = "home" | "agenda" | "attendance" | "journal" | "students" | "targets" | "reports" | "team" | "chat" | "settings" | "region" | "admin";
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
  { id: "region", label: "Wilayah", icon: Buildings, hint: "Desa dan kelompok" },
  { id: "team", label: "Tim & Akses", icon: Users, hint: "Anggota dan login" },
  { id: "chat", label: "Komunikasi", icon: Bell, hint: "Chat dan pengumuman" },
  { id: "settings", label: "Pengaturan", icon: Gear, hint: "Profil, AI, dan tema" },
];

const desktopNavItems = [
  ...navItems,
  ...menuItems,
];

const superAdminItem = { id: "admin" as Screen, label: "Super Admin", icon: UserCircle, hint: "Akun, akses, dan login" };
const maintenanceMenuItems = [superAdminItem, menuItems.find((item) => item.id === "settings")!];

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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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

  const roleScreens: Record<Role, Screen[]> = {
    "Super Admin": ["home", "admin", "settings"],
    "Admin Daerah": ["home", "agenda", "attendance", "reports", "journal", "students", "targets", "region", "team", "chat", "settings"],
    "Admin Desa": ["home", "agenda", "attendance", "reports", "journal", "students", "targets", "region", "team", "chat", "settings"],
    "PJ Kelompok": ["home", "agenda", "attendance", "reports", "journal", "students", "targets", "team", "chat", "settings"],
    "Pengajar": ["home", "agenda", "attendance", "reports", "journal", "students", "targets", "chat", "settings"],
  };
  const allowedIds = roleScreens[role];
  const allowedNavigation = role === "Super Admin" ? [{ ...navItems[0] }, superAdminItem, menuItems.find((item) => item.id === "settings")!] : desktopNavItems.filter((item) => allowedIds.includes(item.id));
  const allowedMenuItems = role === "Super Admin" ? maintenanceMenuItems : menuItems.filter((item) => allowedIds.includes(item.id));
  const signOut = async () => { setMenuOpen(false); setNotificationsOpen(false); await supabase?.auth.signOut(); };
  const scopeType = role === "Admin Daerah" ? "DAERAH" : role === "Admin Desa" ? "DESA" : role === "PJ Kelompok" || role === "Pengajar" ? "KELOMPOK" : "PLATFORM";
  const scopeName = role === "Admin Daerah"
    ? (workspace.areas[0]?.name ?? "Wilayah")
    : role === "Admin Desa"
      ? (workspace.villages[0]?.name ?? "Desa")
      : role === "PJ Kelompok" || role === "Pengajar"
        ? (workspace.groups[0]?.name ?? "Kelompok")
        : "One Pro";
  const scopeParent = role === "Admin Desa"
    ? (workspace.areas[0]?.name ? `Daerah ${workspace.areas[0].name}` : role)
    : role === "PJ Kelompok" || role === "Pengajar"
      ? (workspace.villages[0]?.name ? `Desa ${workspace.villages[0].name}` : role)
      : role;

  return (
    <div className={cx("one-pro-shell", dark && "is-dark")}>
      <aside className="desktop-sidebar" aria-label="Navigasi desktop">
        <button className="desktop-brand" onClick={() => go("home")}>
          <span className="desktop-brand-logo" />
          <span><strong>One Pro</strong><small>Jurnal Digital</small></span>
        </button>
        <div className="desktop-scope"><span>{scopeType}</span><strong>{scopeName}</strong><small>{scopeParent}</small></div>
        <nav className="desktop-nav">
          {allowedNavigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={cx(screen === item.id && "active")} onClick={() => go(item.id)}><Icon size={20} weight={screen === item.id ? "fill" : "regular"} /><span>{item.label}</span></button>;
          })}
        </nav>
        <button className="desktop-sidebar-footer logout-link" onClick={() => void signOut()}><SignOut size={18} />Keluar akun</button>
      </aside>
      <header className="topbar">
        <div className="topbar-leading">
          <button className="mobile-menu-trigger" onClick={() => setMenuOpen(true)} aria-label="Buka navigasi"><List size={22} /></button>
          <button className="brand-button" onClick={() => go("home")} aria-label="Buka beranda">
            <img src="/brand/one-pro-logo.svg" alt="One Pro" />
            <span><strong>One Pro</strong><small>Jurnal Digital</small></span>
          </button>
        </div>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label={dark ? "Gunakan mode terang" : "Gunakan mode gelap"}>
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="icon-button notification-button" onClick={() => setNotificationsOpen(true)} aria-label="Buka notifikasi">
            <Bell size={20} /><span>{workspace.schedules.length ? 2 : 1}</span>
          </button>
        </div>
      </header>

      <MobileScroll className="app-screen">
        <main className={cx("screen-content", `screen-${screen}`)} data-testid="one-pro-app">
          {dataState === "loading" ? <div className="data-sync" role="status">Menyinkronkan data…</div> : null}
          {screen === "home" ? role === "Super Admin" ? <SuperAdminHome go={go} /> : <Home role={role} setRole={setRole} go={go} previewMode={previewMode} workspace={workspace} notify={notify} /> : null}
          {screen === "agenda" ? <Agenda notify={notify} go={go} workspace={workspace} refresh={refreshWorkspace} userId={authUser?.id} previewMode={previewMode} canManage={role === "PJ Kelompok"} /> : null}
          {screen === "attendance" ? <AttendanceWorkspace notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} role={role} /> : null}
          {screen === "journal" ? (role === "Admin Daerah" || role === "Admin Desa" ? <RegionalJournalMonitor notify={notify} workspace={workspace} previewMode={previewMode} role={role} /> : <JournalWorkspace notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} role={role} />) : null}
          {screen === "students" ? <StudentDatabaseHub notify={notify} workspace={workspace} refresh={refreshWorkspace} role={role} previewMode={previewMode}><Students notify={notify} workspace={workspace} refresh={refreshWorkspace} previewMode={previewMode} role={role} /></StudentDatabaseHub> : null}
          {screen === "targets" ? <Targets notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} canManage={role === "Admin Daerah"} /> : null}
          {screen === "reports" ? <Reports notify={notify} workspace={workspace} previewMode={previewMode} role={role} /> : null}
          {screen === "region" && (role === "Admin Daerah" || role === "Admin Desa") ? <RegionStructureManager notify={notify} workspace={workspace} refresh={refreshWorkspace} role={role} previewMode={previewMode} /> : null}
          {screen === "team" ? <Team notify={notify} workspace={workspace} role={role} previewMode={previewMode} /> : null}
          {screen === "admin" ? <Team notify={notify} workspace={workspace} role={role} previewMode={previewMode} superView /> : null}
          {screen === "chat" ? <Chat notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} role={role} /> : null}
          {screen === "settings" ? <Settings dark={dark} setDark={setDark} notify={notify} onSignOut={() => void signOut()} role={role} workspace={workspace} /> : null}
        </main>
      </MobileScroll>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        {(role === "Super Admin" ? [navItems[0]] : navItems.filter((item) => allowedIds.includes(item.id))).map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={cx(screen === item.id && "active")} onClick={() => go(item.id)}><Icon size={21} weight={screen === item.id ? "fill" : "regular"} /><span>{item.label}</span></button>;
        })}
        <button className={cx(menuOpen && "active")} onClick={() => setMenuOpen(true)}><List size={21} /><span>Menu</span></button>
      </nav>

      {menuOpen ? <div className="mobile-nav-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
        <aside className="mobile-nav-drawer" aria-label="Navigasi mobile">
          <div className="mobile-nav-head">
            <button className="mobile-nav-brand" onClick={() => go("home")}><span className="desktop-brand-logo"/><span><strong>One Pro</strong><small>Jurnal Digital</small></span></button>
            <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Tutup navigasi"><X size={19}/></button>
          </div>
          <div className="mobile-nav-scope"><span>{scopeType}</span><strong>{scopeName}</strong><small>{scopeParent}</small></div>
          <nav className="mobile-nav-list">{allowedNavigation.map((item) => { const Icon=item.icon; return <button key={item.id} className={cx(screen===item.id&&"active")} onClick={() => go(item.id)}><Icon size={20} weight={screen===item.id?"fill":"regular"}/><span>{item.label}</span><CaretRight size={15}/></button>; })}</nav>
          <button className="mobile-nav-logout" onClick={() => void signOut()}><SignOut size={18}/>Keluar akun</button>
        </aside>
      </div> : null}

      {toast ? <div className="toast" role="status"><CheckCircle size={20} weight="fill" />{toast}</div> : null}
      {notificationsOpen ? <div className="editor-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setNotificationsOpen(false); }}><section className="editor-panel notification-panel"><div className="editor-head"><div><span className="eyebrow">NOTIFIKASI</span><h2>Pengingat kegiatan</h2></div><button className="icon-button" onClick={() => setNotificationsOpen(false)}><X size={19}/></button></div><div className="card-list"><ActionRow icon={<CalendarBlank size={19}/>} title="Periksa agenda hari ini" meta="Pastikan materi dan jam pengajian sudah diisi" onClick={() => { setNotificationsOpen(false); go("agenda"); }}/><ActionRow icon={<ClipboardText size={19}/>} title="Jurnal belum lengkap" meta="Pengingat dikirim pukul 20.00 pada hari mengaji" onClick={() => { setNotificationsOpen(false); go(allowedIds.includes("journal") ? "journal" : "reports"); }}/></div></section></div> : null}
    </div>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div>;
}

function SuperAdminHome({ go }: { go: (screen: Screen) => void }) {
  return <>
    <div className="context-row"><div><span className="eyebrow">PEMELIHARAAN SISTEM</span><h1>One Pro Jurnal Digital</h1></div><span className="role-badge">Super Admin</span></div>
    <section className="focus-panel maintenance-hero"><div className="focus-head"><div><span>STATUS PLATFORM</span><strong>Berjalan normal</strong><small>Data operasional tetap dikelola oleh Daerah, Desa, dan Kelompok.</small></div><CheckCircle size={27} weight="fill" /></div></section>
    <section className="metric-strip"><Metric value="Aktif" label="Supabase" /><Metric value="Ready" label="Deployment" /><Metric value="0" label="Gangguan" /></section>
    <SectionTitle title="Pemeliharaan utama" />
    <div className="action-list"><ActionRow icon={<UserCircle />} title="Kelola akun dan akses" meta="Buat, ubah, nonaktifkan, atau hapus user" onClick={() => go("admin")} /><ActionRow icon={<ChartLineUp />} title="Riwayat aktivitas login" meta="Pantau login dan perubahan akun" onClick={() => go("admin")} /><ActionRow icon={<Gear />} title="Pengaturan platform" meta="Tema, koneksi, dan konfigurasi web" onClick={() => go("settings")} /></div>
    <div className="info-callout"><WarningCircle size={19} /><span><strong>Data operasional dipisahkan</strong><small>Super Admin tidak mengisi presensi, jurnal, target, atau laporan. Akses data tersebut diberikan melalui akun tingkat wilayah.</small></span></div>
  </>;
}

function Home({ role, setRole, go, previewMode, workspace, notify }: { role: Role; setRole: (role: Role) => void; go: (screen: Screen) => void; previewMode: boolean; workspace: WorkspaceData; notify: (message: string) => void }) {
  if (role === "Admin Daerah" || role === "Admin Desa") {
    return <>{previewMode ? <div className="context-row"><div><span className="eyebrow">PRATINJAU ROLE</span><h1>Monitoring wilayah</h1></div><select value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Pratinjau peran">{(["Pengajar", "PJ Kelompok", "Admin Desa", "Admin Daerah", "Super Admin"] as Role[]).map((item) => <option key={item}>{item}</option>)}</select></div> : null}<RegionalMonitoringHome role={role} go={go} workspace={workspace} previewMode={previewMode} notify={notify} /></>;
  }
  const groupName = workspace.groups[0]?.name ?? "Kelompok";
  const areaName = workspace.areas[0]?.name ?? "Malang Timur";
  return <>
    <div className="context-row">
      <div><span className="eyebrow">{areaName.toUpperCase()}</span><h1>{role === "Pengajar" ? "Kelas hari ini" : groupName}</h1></div>
      {previewMode ? <select value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Pratinjau peran">
        {(["Pengajar", "PJ Kelompok", "Admin Desa", "Admin Daerah", "Super Admin"] as Role[]).map((item) => <option key={item}>{item}</option>)}
      </select> : <span className="role-badge">{role}</span>}
    </div>
    <OperationalHome go={go} workspace={workspace} previewMode={previewMode} />
  </>;
}

function OperationalHome({ go, workspace, previewMode }: { go: (screen: Screen) => void; workspace: WorkspaceData; previewMode: boolean }) {
  const [attendanceRows, setAttendanceRows] = useState<Array<{ student_id: string; status: "hadir" | "izin" | "alpha"; session_date: string; class_id: string }>>([]);
  const activeClasses = workspace.classes.filter((item) => item.is_active);
  const studentCount = workspace.students.length;
  const monthKeyFor = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = monthKeyFor(new Date());
  const currentMonthRows = attendanceRows.filter((row) => row.session_date.startsWith(currentMonth));
  const attendancePercent = currentMonthRows.length ? Math.round((currentMonthRows.filter((row) => row.status === "hadir").length / currentMonthRows.length) * 100) : 0;

  useEffect(() => {
    let cancelled = false;
    if (previewMode) {
      setAttendanceRows([]);
      return () => { cancelled = true; };
    }
    loadAttendanceSummary()
      .then((rows) => { if (!cancelled) setAttendanceRows(rows); })
      .catch((error) => console.error("Dashboard attendance summary failed", error));
    return () => { cancelled = true; };
  }, [previewMode]);

  const classAttendance = activeClasses.map((klass) => {
    const rows = currentMonthRows.filter((row) => row.class_id === klass.id);
    const present = rows.filter((row) => row.status === "hadir").length;
    return { id: klass.id, name: klass.name, percent: rows.length ? Math.round((present / rows.length) * 100) : 0, hasData: rows.length > 0 };
  });

  const monthSeries = [-2, -1, 0, 1, 2].map((offset) => {
    const base = new Date();
    const date = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const key = monthKeyFor(date);
    const rows = attendanceRows.filter((row) => row.session_date.startsWith(key));
    const present = rows.filter((row) => row.status === "hadir").length;
    const percent = rows.length ? Math.round((present / rows.length) * 100) : null;
    return {
      key,
      label: new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(date).replace(".", ""),
      percent,
      current: offset === 0,
    };
  });

  const currentMonthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date());

  return <>
    <section className="dashboard-summary-grid" aria-label="Ringkasan kelompok">
      <button className="summary-stat-card" onClick={() => go("agenda")}>
        <span>DATA KELAS</span><strong>{activeClasses.length}</strong><small>Kelas aktif yang sudah dibuat</small>
      </button>
      <button className="summary-stat-card" onClick={() => go("students")}>
        <span>DATA SISWA</span><strong>{studentCount}</strong><small>Seluruh siswa tersimpan</small>
      </button>
      <button className="summary-stat-card attendance" onClick={() => go("reports")}>
        <span>PRESENSI BULAN INI</span><strong>{attendancePercent}%</strong><small>Rekap {currentMonthLabel}</small>
      </button>
    </section>

    <section className="attendance-dashboard-card">
      <div className="dashboard-card-head">
        <div><span className="eyebrow">PRESENSI PER KELAS</span><h2>Rata-rata kehadiran bulan ini</h2></div>
        <strong>{currentMonthLabel}</strong>
      </div>
      {classAttendance.length ? <div className="class-attendance-bars">
        {classAttendance.map((item) => <div className="class-attendance-row" key={item.id}>
          <div className="class-attendance-meta"><span>{item.name}</span><strong>{item.hasData ? `${item.percent}%` : "—"}</strong></div>
          <div className="class-attendance-track" aria-label={`${item.name}: ${item.hasData ? `${item.percent}%` : "belum ada data"}`}><span style={{ width: `${item.hasData ? item.percent : 0}%` }} /></div>
        </div>)}
      </div> : <EmptyState icon={<ChartLineUp size={30} />} title="Belum ada kelas" text="Kelas yang dibuat akan otomatis muncul pada grafik kehadiran." />}
    </section>

    <section className="attendance-dashboard-card month-trend-card">
      <div className="dashboard-card-head">
        <div><span className="eyebrow">REKAP 5 BULAN</span><h2>Perbandingan kehadiran bulanan</h2></div>
        <small>Bulan berjalan selalu di tengah</small>
      </div>
      <div className="month-trend-chart" aria-label="Grafik kehadiran lima bulan">
        {monthSeries.map((item) => <div className={cx("month-trend-item", item.current && "current")} key={item.key}>
          <b>{item.percent === null ? "—" : `${item.percent}%`}</b>
          <div className="month-trend-bar"><span style={{ height: `${item.percent ?? 0}%` }} /></div>
          <strong>{item.label}</strong>
        </div>)}
      </div>
      <p className="dashboard-chart-note">Persentase dihitung dari data presensi yang sudah masuk pada masing-masing bulan.</p>
    </section>
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

function Agenda({ notify, go, workspace, refresh, userId, previewMode, canManage }: { notify: (message: string) => void; go: (screen: Screen) => void; workspace: WorkspaceData; refresh: () => Promise<void>; userId?: string; previewMode: boolean; canManage: boolean }) {
  const today = new Date();
  const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dateFromKey = (key: string) => { const [year, month, day] = key.split("-").map(Number); return new Date(year, month - 1, day, 12, 0, 0); };
  const [activeDate, setActiveDate] = useState(localDateKey(today));
  const [open, setOpen] = useState<"schedule" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [classId, setClassId] = useState(workspace.classes[0]?.id ?? "");
  const [groupId, setGroupId] = useState(workspace.groups[0]?.id ?? "");
  const [className, setClassName] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:30");
  const [materialPlan, setMaterialPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const gridStart = new Date(monthStart); gridStart.setDate(1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  const activeDay = dateFromKey(activeDate);
  const activeWeekday = activeDay.getDay();
  const schedules = previewMode ? [] : workspace.schedules.filter((item) => item.is_active && item.weekday === activeWeekday);

  const setSelectedDate = (key: string) => {
    const date = dateFromKey(key);
    setActiveDate(key);
    if (date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear()) {
      setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const moveMonth = (offset: number) => {
    const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
    setCalendarMonth(next);
    setActiveDate(localDateKey(next));
  };

  const submitClass = async () => {
    if (previewMode) { notify("Mode pratinjau: kelas tidak disimpan"); setOpen(null); return; }
    if (!groupId || !className.trim()) { notify("Nama kelas dan kelompok wajib diisi"); return; }
    setSaving(true); try { await saveClass({ groupId, name: className }); await refresh(); notify("Kelas berhasil dibuat"); setClassName(""); setOpen(null); } catch (error) { notify(error instanceof Error ? error.message : "Kelas gagal dibuat"); } finally { setSaving(false); }
  };
  const submitSchedule = async () => {
    if (previewMode) { notify("Mode pratinjau: jadwal tidak disimpan"); setOpen(null); return; }
    if (!classId || !userId) { notify("Pilih kelas terlebih dahulu"); return; }
    setSaving(true); try { await saveSchedule({ classId, teacherId: userId, weekday: activeWeekday, startTime, endTime, materialPlan }); await refresh(); notify("Jadwal berhasil disimpan"); setOpen(null); } catch (error) { notify(error instanceof Error ? error.message : "Jadwal gagal disimpan"); } finally { setSaving(false); }
  };
  return <>
    <PageHeader title="Jadwal Mengaji" subtitle={canManage ? "Atur agenda rutin kelompok" : "Pantau agenda kelompok dalam satu bulan"} action={canManage ? <button className="primary-icon" onClick={() => { setClassId(workspace.classes[0]?.id ?? ""); setOpen("schedule"); }} aria-label="Tambah jadwal"><Plus size={20} /></button> : undefined} />
    <section className="agenda-calendar-shell">
      <div className="calendar-head"><button className="icon-button" onClick={() => moveMonth(-1)} aria-label="Bulan sebelumnya">‹</button><strong>{new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(calendarMonth)}</strong><button className="icon-button" onClick={() => moveMonth(1)} aria-label="Bulan berikutnya">›</button></div>
      <div className="month-calendar"><div className="calendar-weekdays">{["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map(d=><span key={d}>{d}</span>)}</div><div className="calendar-grid">{days.map((date) => {
        const key = localDateKey(date);
        const daySchedules = workspace.schedules.filter((item) => item.is_active && item.weekday === date.getDay());
        return <button key={key} className={cx(activeDate===key&&"active",localDateKey(today)===key&&"today",date.getMonth()!==calendarMonth.getMonth()&&"outside")} onClick={()=>setSelectedDate(key)} aria-label={new Intl.DateTimeFormat("id-ID",{dateStyle:"full"}).format(date)}>
          <span className="calendar-date-number">{date.getDate()}</span>
          {daySchedules.length ? <span className="calendar-agenda-preview">{daySchedules.slice(0,2).map((item) => { const klass = workspace.classes.find((candidate) => candidate.id === item.class_id); return <em key={item.id}>{klass?.name ?? "Agenda"}</em>; })}{daySchedules.length > 2 ? <small>+{daySchedules.length - 2}</small> : null}</span> : null}
        </button>;
      })}</div></div>
    </section>
    <SectionTitle title={`${schedules.length} agenda • ${new Intl.DateTimeFormat("id-ID",{dateStyle:"full"}).format(activeDay)}`} />
    {schedules.length ? <div className="schedule-list card-list">{schedules.map((item) => { const klass = workspace.classes.find((candidate) => candidate.id === item.class_id); return <div className="schedule-row-wrap" key={item.id}><Schedule time={item.start_time.slice(0, 5)} end={item.end_time.slice(0, 5)} title={klass?.name ?? "Kelas"} teacher={item.material_plan || "Materi belum diisi"} status="Terjadwal" tone="neutral" action={() => go("journal")} />{canManage ? <button className="icon-button" onClick={async () => { if (!previewMode) { await deleteSchedule(item.id); await refresh(); notify("Jadwal dinonaktifkan"); } }} aria-label="Nonaktifkan jadwal"><Trash size={16} /></button> : null}</div>; })}</div> : <EmptyState icon={<CalendarBlank size={30} />} title="Belum ada agenda" text="Tidak ada agenda yang terdaftar pada tanggal yang dipilih." />}
    {open ? <div className="editor-overlay" onMouseDown={(e)=>{if(e.target===e.currentTarget)setOpen(null)}} role="dialog" aria-modal="true" aria-label="Tambah jadwal"><section className="editor-panel"><div className="editor-head"><div><span className="eyebrow">JADWAL MENGAJI</span><h2>Tambah agenda</h2></div><button className="icon-button" onClick={() => setOpen(null)} aria-label="Tutup"><X size={19}/></button></div><label className="field"><span>Tanggal</span><KeyboardInput type="date" value={activeDate} onChange={(event)=>setSelectedDate(event.target.value)}/></label><label className="field"><span>Kelas</span><select value={classId} onChange={(event) => setClassId(event.target.value)}>{workspace.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="form-grid two"><label className="field"><span>Mulai</span><KeyboardInput type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="field"><span>Selesai</span><KeyboardInput type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div><label className="field"><span>Materi rencana</span><KeyboardTextarea value={materialPlan} onChange={(event) => setMaterialPlan(event.target.value)} rows={3} placeholder="Materi yang akan diajarkan" /></label><label className="switch-row"><span><strong>Jadikan jadwal rutin</strong><small>Berulang setiap minggu pada hari yang sama</small></span><span className="status success">Aktif</span></label><button className="primary-button" disabled={saving || !classId} onClick={() => void submitSchedule()}>{saving ? "Menyimpan…" : "Simpan agenda"}</button></section></div> : null}
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
    <PageHeader title="Jurnal Online" subtitle="Jurnal harian dan perkembangan setiap anak" />
    <div className="segmented"><button className={cx(!progress&&"active")} onClick={()=>setProgress(false)}>Jurnal Harian</button><button className={cx(progress&&"active")} onClick={()=>setProgress(true)}>Jurnal Siswa</button></div>
    <section className="data-card form-card">
      <div className="form-grid two"><label className="field"><span>Kelas</span><select value={classId} onChange={(event) => setClassId(event.target.value)}>{previewMode ? <option value="demo">Kelas Al-Fatihah</option> : workspace.classes.filter((item) => item.is_active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Tanggal</span><KeyboardInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
      <div className="form-grid two"><label className="field"><span>Jam mulai</span><KeyboardInput type="time" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label><label className="field"><span>Jam selesai</span><KeyboardInput type="time" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} /></label></div>
      <label className="field"><span>Materi yang disampaikan</span><KeyboardTextarea value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Tuliskan materi hari ini" rows={3} /></label>
      <label className="field"><span>Pencapaian</span><KeyboardTextarea value={achievement} onChange={(event) => setAchievement(event.target.value)} placeholder="Capaian pembelajaran hari ini" rows={2} /></label>
      <label className="field"><span>Keluhan atau kendala</span><KeyboardTextarea value={obstacles} onChange={(event) => setObstacles(event.target.value)} placeholder="Kendala yang ditemukan" rows={2} /></label>
      <label className="field"><span>Saran pembenahan berikutnya</span><KeyboardTextarea value={improvementPlan} onChange={(event) => setImprovementPlan(event.target.value)} placeholder="Langkah perbaikan pertemuan berikutnya" rows={2} /></label>
      <label className="field"><span>Catatan tambahan</span><KeyboardTextarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan lain bila ada" rows={2} /></label>
      <label className="switch-row"><span><strong>Catat progres individu</strong><small>Opsional; anak yang tidak hadir boleh dilewati</small></span><button className={cx("switch", progress && "on")} onClick={() => setProgress((value) => !value)} aria-label="Catat progres individu"><span /></button></label>
      {progress ? <div className="progress-entry"><div className="student-mini"><Avatar initials="AF" /><span><strong>Ahmad Fauzan</strong><small>Target: Mengenal huruf hijaiyah</small></span></div><div className="chip-row">{["Mulai","Berkembang","Perlu penguatan","Tercapai"].map((item, index) => <button key={item} className={cx(index === 1 && "active")}>{item}</button>)}</div><TextArea label="Catatan pengamatan" placeholder="Contoh: masih tertukar huruf ba dan ta" /></div> : null}
    </section>
    <button className="primary-button" disabled={saving} onClick={() => void submit()}><Check size={18} />{saving ? "Menyimpan…" : "Simpan jurnal"}</button>
  </>;
}

function Students({ notify, workspace, refresh, previewMode, role }: { notify: (message: string) => void; workspace: WorkspaceData; refresh: () => Promise<void>; previewMode: boolean; role: Role }) {
  const [showPhotos, setShowPhotos] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<WorkspaceStudent | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage = role === "PJ Kelompok";
  const liveStudents = previewMode ? demoStudents.map((student) => ({ id: String(student.id), group_id: "demo", full_name: student.name, nickname: null, birth_place: null, birth_date: null, address: null, phone: null, father_name: null, mother_name: null, father_phone: null, mother_phone: null, school_grade: student.grade === "PAUD" ? 0 : Number(student.grade.match(/\d/)?.[0] ?? 1), photo_path: null, show_photo: true, status: student.active ? "active" as const : "inactive" as const })) : workspace.students;
  const filtered = useMemo(() => liveStudents.filter((student) => student.full_name.toLowerCase().includes(query.toLowerCase())), [liveStudents, query]);
  const activeCount = liveStudents.filter((student) => student.status === "active").length;
  const inactiveCount = liveStudents.filter((student) => student.status !== "active").length;
  return <>
    <PageHeader title="Database Anak" subtitle={`${activeCount} aktif • ${inactiveCount} nonaktif`} action={canManage ? <button className="primary-icon" onClick={() => setEditing("new")} aria-label="Tambah anak"><Plus size={20} /></button> : undefined} />
    <div className="toolbar"><label className="search"><MagnifyingGlass size={17} /><KeyboardInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama anak" /></label><button className={cx("photo-toggle", showPhotos && "active")} onClick={() => setShowPhotos((value) => !value)}><UserCircle size={18} />Foto</button></div>
    {filtered.length ? <div className="student-list">{filtered.map((student) => <button className="student-row" key={student.id} onClick={() => { if (canManage) setEditing(student); }} aria-label={canManage ? `Edit ${student.full_name}` : `Data ${student.full_name}`}>{showPhotos && student.show_photo ? <Avatar initials={initialsFor(student.full_name)} muted={student.status !== "active"} /> : null}<span><strong>{student.full_name}</strong><small>{gradeLabel(student.school_grade)} • {student.status === "active" ? "Aktif" : "Nonaktif — riwayat tetap tersimpan"}</small></span>{canManage ? <PencilSimple size={17} /> : null}</button>)}</div> : <EmptyState icon={<Student size={30} />} title="Belum ada data anak" text={canManage ? "Tambahkan anak atau impor data Excel." : "Belum ada data siswa pada wilayah yang dapat dipantau."} />}
    {canManage ? <div className="split-actions"><button className="secondary-button" onClick={() => notify("Template Excel siap diunduh")}><DownloadSimple size={17} />Template</button><button className="secondary-button" onClick={() => notify("Pilih file Excel untuk diimpor")}><UploadSimple size={17} />Import</button></div> : <div className="info-callout"><WarningCircle size={18}/><span><strong>Mode monitoring</strong><small>Perubahan data anak dilakukan oleh PJ Kelompok. Akun wilayah melihat data sesuai naungannya.</small></span></div>}
    {canManage && editing ? <StudentEditor student={editing === "new" ? null : editing} groups={workspace.groups} saving={saving} onClose={() => setEditing(null)} onSave={async (values) => {
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
    photo_path: student?.photo_path ?? "",
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
        <label className="field"><span>Foto anak (opsional)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>{const file=event.target.files?.[0]; if(!file)return; if(file.size>1500000){alert("Ukuran foto maksimal 1,5 MB");return;} const reader=new FileReader(); reader.onload=()=>field("photo_path",String(reader.result)); reader.readAsDataURL(file);}} /></label>
        {form.photo_path ? <div className="student-photo-preview"><img src={form.photo_path} alt="Pratinjau foto anak"/><button className="secondary-button" type="button" onClick={()=>field("photo_path","")}>Hapus foto</button></div> : null}
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

function Targets({ notify, workspace, userId, previewMode, canManage }: { notify: (message: string) => void; workspace: WorkspaceData; userId?: string; previewMode: boolean; canManage: boolean }) {
  const [targets, setTargets] = useState<WorkspaceTarget[]>([]);
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceTarget | null>(null);
  const [grade, setGrade] = useState(0); const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [value, setValue] = useState(""); const [unit, setUnit] = useState(""); const [saving, setSaving] = useState(false);
  const refresh = async () => { if (previewMode) { setTargets([{ id: "p1", version_id: "v", school_grade: 0, code: "PAUD-01", title: "Doa harian dasar", description: "", target_value: 3, target_unit: "indikator", sort_order: 1 }, { id: "p2", version_id: "v", school_grade: 1, code: "SD1-01", title: "Mengenal huruf hijaiyah", description: "", target_value: 5, target_unit: "indikator", sort_order: 2 }]); return; } try { setTargets(await loadTargets()); } catch (error) { notify(error instanceof Error ? error.message : "Target gagal dimuat"); } };
  useEffect(() => { void refresh(); }, [previewMode]);
  const openEditor = (target?: WorkspaceTarget) => { setEditing(target ?? null); setGrade(target?.school_grade ?? 0); setTitle(target?.title ?? ""); setDescription(target?.description ?? ""); setValue(target?.target_value ? String(target.target_value) : ""); setUnit(target?.target_unit ?? "indikator"); setOpen(true); };
  const submit = async () => { if (previewMode) { notify("Mode pratinjau: target tidak disimpan"); setOpen(false); return; } const areaId = workspace.areas[0]?.id; if (!areaId || !userId || !title.trim()) { notify("Daerah, judul target, dan akun wajib tersedia"); return; } setSaving(true); try { await saveTarget({ id: editing?.id, areaId, createdBy: userId, schoolGrade: grade, title, description, targetValue: value ? Number(value) : undefined, targetUnit: unit }); notify(editing ? "Target diperbarui" : "Target berhasil ditambahkan"); setOpen(false); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "Target gagal disimpan"); } finally { setSaving(false); } };
  const visible = gradeFilter === null ? targets : targets.filter((item) => item.school_grade === gradeFilter);
  return <>
    <PageHeader title="Target Pembelajaran" subtitle={canManage ? "Kelola target daerah untuk seluruh jenjang" : "Target daerah — akses lihat saja"} action={canManage ? <button className="primary-icon" onClick={() => openEditor()} aria-label="Tambah target"><Plus size={20} /></button> : undefined} />
    <div className="filter-pills"><button className={cx(gradeFilter === null && "active")} onClick={() => setGradeFilter(null)}>Semua</button>{[0,1,2,3,4,5,6].map((item) => <button key={item} className={cx(gradeFilter === item && "active")} onClick={() => setGradeFilter(item)}>{gradeLabel(item)}</button>)}</div>
    {visible.length ? <div className="target-list">{visible.map((target) => <div className="target-row-wrap" key={target.id}><button className="target-row" onClick={() => openEditor(target)}><span className="target-icon"><Target size={20} /></span><span><small>{gradeLabel(target.school_grade)}{target.code ? ` • ${target.code}` : ""}</small><strong>{target.title}</strong><em>{target.target_value ?? "—"} {target.target_unit ?? ""}</em></span><CaretRight size={16} /></button><button className="icon-button" onClick={async () => { if (!previewMode) { await deleteTarget(target.id); await refresh(); notify("Target dihapus"); } }} aria-label={`Hapus ${target.title}`}><Trash size={16} /></button></div>)}</div> : <EmptyState icon={<Target size={30} />} title="Belum ada target" text="Daerah dapat menambahkan target per jenjang dari tombol tambah." />}
    {canManage ? <button className="secondary-button" onClick={() => notify("Pilih file Excel target sesuai format daerah")}><UploadSimple size={17} />Import target Excel</button> : <div className="info-callout"><WarningCircle size={18}/><span><strong>Akses pemantauan</strong><small>Target hanya dapat ditambah, diubah, dan diimpor oleh Admin Daerah.</small></span></div>}
    {open ? <div className="editor-overlay" role="dialog" aria-modal="true" aria-label="Form target"><section className="editor-panel"><div className="editor-head"><div><span className="eyebrow">TARGET DAERAH</span><h2>{editing ? "Edit target" : "Tambah target"}</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Tutup"><X size={19} /></button></div><label className="field"><span>Jenjang</span><select value={grade} onChange={(event) => setGrade(Number(event.target.value))}>{[0,1,2,3,4,5,6].map((item) => <option value={item} key={item}>{gradeLabel(item)}</option>)}</select></label><label className="field"><span>Judul target</span><KeyboardInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Mengenal huruf hijaiyah" /></label><label className="field"><span>Deskripsi atau indikator</span><KeyboardTextarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label><div className="form-grid two"><label className="field"><span>Nilai target</span><KeyboardInput type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label><label className="field"><span>Satuan</span><KeyboardInput value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="indikator / halaman / persen" /></label></div><button className="primary-button" disabled={saving || !title.trim()} onClick={() => void submit()}>{saving ? "Menyimpan…" : "Simpan target"}</button></section></div> : null}
  </>;
}

function Reports({ notify, workspace, previewMode, role }: { notify: (message: string) => void; workspace: WorkspaceData; previewMode: boolean; role: Role }) {
  const [tab, setTab] = useState<"individual" | "class">("individual");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [villageFilter, setVillageFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [attendance, setAttendance] = useState<Array<{ student_id: string; status: "hadir" | "izin" | "alpha"; session_date: string; class_id: string }>>([]);
  const regionalRole = role === "Admin Daerah" || role === "Admin Desa";
  useEffect(() => { if (!previewMode) loadAttendanceSummary().then(setAttendance).catch((error) => notify(error instanceof Error ? error.message : "Rekap presensi gagal dimuat")); }, [previewMode]);

  const visibleVillages = workspace.villages;
  const visibleGroups = workspace.groups.filter(group => villageFilter === "all" || group.village_id === villageFilter);
  const allowedGroupIds = new Set(visibleGroups.filter(group => groupFilter === "all" || group.id === groupFilter).map(group => group.id));
  const visibleClasses = workspace.classes.filter(item => item.is_active && allowedGroupIds.has(item.group_id));

  useEffect(() => {
    if (villageFilter !== "all" && !visibleVillages.some(item => item.id === villageFilter)) setVillageFilter("all");
    if (groupFilter !== "all" && !visibleGroups.some(item => item.id === groupFilter)) setGroupFilter("all");
  }, [villageFilter, groupFilter, visibleVillages, visibleGroups]);
  useEffect(() => {
    if (classFilter !== "all" && !visibleClasses.some(item => item.id === classFilter)) setClassFilter("all");
  }, [groupFilter, villageFilter, classFilter, visibleClasses]);
  useEffect(() => { if (tab === "class" && classFilter === "all") setClassFilter(visibleClasses[0]?.id ?? "all"); }, [tab, classFilter, visibleClasses]);

  const monthRows = attendance.filter((row) => row.session_date.startsWith(month));
  const students = previewMode ? demoStudents.map((student) => ({ id: String(student.id), full_name: student.name, school_grade: student.grade === "PAUD" ? 0 : Number(student.grade.match(/\d/)?.[0] ?? 1), group_id: "demo" })) : workspace.students.filter((student) => student.status !== "archived" && allowedGroupIds.has(student.group_id));
  const selectedIds = classFilter === "all" ? null : new Set(workspace.enrollments.filter(e => e.class_id === classFilter).map(e => e.student_id));
  const studentStats = students.filter(s => !selectedIds || selectedIds.has(s.id)).map((student) => { const rows = monthRows.filter((row) => row.student_id === student.id && (classFilter === "all" || row.class_id === classFilter)); const present = rows.filter((row) => row.status === "hadir").length; return { student, total: rows.length, present, izin: rows.filter((row) => row.status === "izin").length, alpha: rows.filter((row) => row.status === "alpha").length, percent: rows.length ? Math.round((present / rows.length) * 100) : 0 }; });
  const download = async (kind: "csv" | "print") => { if (kind === "print") { const reportClient = supabase; if (!previewMode && reportClient) { const classIds = classFilter === "all" ? visibleClasses.map((item) => item.id) : [classFilter]; await Promise.allSettled(classIds.map((classId) => reportClient.functions.invoke("analyze-monthly-journal", { body: { classId, month } }))); } window.print(); return; } const csv = ["Nama,Jenjang,Wajib hadir,Hadir,Izin,Alpha,Persentase", ...studentStats.map((item) => [item.student.full_name, gradeLabel(item.student.school_grade), item.total, item.present, item.izin, item.alpha, `${item.percent}%`].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `laporan-individu-${month}.csv`; link.click(); URL.revokeObjectURL(url); notify("Laporan CSV berhasil diunduh"); };
  return <>
    <PageHeader title="Laporan" subtitle={regionalRole ? "Filter wilayah, bulan, dan kelas sebelum membuat laporan" : "Pilih bulan dan kelas sebelum membuat laporan"} />
    {regionalRole ? <div className="region-filter-grid report-region-filter">
      {role === "Admin Daerah" ? <label><span>Desa</span><select value={villageFilter} onChange={(event) => { setVillageFilter(event.target.value); setGroupFilter("all"); setClassFilter("all"); }}><option value="all">Semua desa</option>{visibleVillages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
      <label><span>Kelompok</span><select value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setClassFilter("all"); }}><option value="all">Semua kelompok</option>{visibleGroups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div> : null}
    <div className="report-period-panel"><label><span>Bulan laporan</span><KeyboardInput type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label><span>Kelas</span><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>{tab === "individual" ? <option value="all">Semua kelas</option> : null}{visibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="report-period-note"><strong>Semua rekap dan file hanya memakai data bulan dan lingkup yang dipilih.</strong></div></div>
    <div className="report-print-heading"><strong>ONE PRO JURNAL DIGITAL</strong><h1>Laporan Bulanan</h1><p>Rekap presensi dan perkembangan pembelajaran · {month}</p></div>
    <div className="segmented"><button className={cx(tab === "individual" && "active")} onClick={() => setTab("individual")}>Individu</button><button className={cx(tab === "class" && "active")} onClick={() => setTab("class")}>Laporan Kelas</button></div>
    {tab === "individual" ? <><div className="report-actions"><button className="secondary-button" onClick={() => void download("csv")}><DownloadSimple size={17} />CSV</button><button className="secondary-button" onClick={() => void download("print")}><DownloadSimple size={17} />Cetak</button></div><div className="student-report-list">{studentStats.length ? studentStats.map((item) => <section className="student-report data-card" key={item.student.id}><div className="student-mini"><Avatar initials={initialsFor(item.student.full_name)} /><span><strong>{item.student.full_name}</strong><small>{gradeLabel(item.student.school_grade)}</small></span><b>{item.percent}%</b></div><div className="report-stats"><Metric value={String(item.total)} label="Wajib hadir" /><Metric value={String(item.present)} label="Hadir" /><Metric value={String(item.izin)} label="Izin" /><Metric value={String(item.alpha)} label="Alpha" /></div><div className="progress-track"><span style={{ width: `${item.percent}%` }} /></div></section>) : <EmptyState icon={<ChartLineUp size={30} />} title="Belum ada data presensi" text="Belum ada data pada lingkup dan bulan yang dipilih." />}</div></> : <>{classFilter !== "all" ? <><ProfessionalWordReport notify={notify} workspace={workspace} month={month} classId={classFilter} previewMode={previewMode} /><ProfessionalPptReport notify={notify} workspace={workspace} month={month} classId={classFilter} previewMode={previewMode} />{role === "PJ Kelompok" || role === "Pengajar" ? <PptTemplateManager notify={notify} workspace={workspace} classId={classFilter} previewMode={previewMode} /> : null}</> : <EmptyState icon={<ChartLineUp size={30}/>} title="Pilih kelas" text="Pilih satu kelas untuk membuat laporan Word atau PowerPoint." />}</>}
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
  const [formError, setFormError] = useState<string | null>(null);
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

  const openCreate = () => { setEditing(null); setFullName(""); setUsername(""); setPassword(""); setFormError(null); setAccountRole(availableRoles[0]); setOpen(true); };
  const openEdit = (account: WorkspaceAccount) => { setEditing(account); setFullName(account.full_name); setUsername(account.username ?? ""); setPassword(""); setFormError(null); setOpen(true); };
  const submit = async () => {
    if (previewMode) { notify(editing ? "Perubahan akun siap disimpan" : "Akun baru siap dibuat"); setOpen(false); return; }
    const cleanUsername = username.trim().toLowerCase();
    if (!fullName.trim()) { setFormError("Nama lengkap wajib diisi."); return; }
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(cleanUsername)) { setFormError("Username minimal 3 karakter dan hanya boleh memakai huruf kecil, angka, titik, garis bawah, atau tanda minus."); return; }
    if ((!editing || password) && password.length < 6) { setFormError("Password minimal 6 karakter."); return; }
    if (accountRole === "admin_daerah" && !areaId) { setFormError("Pilih daerah untuk akun ini."); return; }
    if (accountRole === "admin_desa" && !villageId) { setFormError("Pilih desa untuk akun ini."); return; }
    if (["pj_kelompok", "pengajar"].includes(accountRole) && !groupId) { setFormError("Pilih kelompok untuk akun ini."); return; }
    setFormError(null);
    setSaving(true);
    try {
      await manageAccount(editing ? { action: "update", userId: editing.user_id, fullName: fullName.trim(), username: cleanUsername, password } : {
        action: "create", fullName: fullName.trim(), username: cleanUsername, password, role: accountRole,
        areaId: accountRole === "admin_daerah" ? areaId : null,
        villageId: accountRole === "admin_desa" ? villageId : null,
        groupId: ["pj_kelompok", "pengajar"].includes(accountRole) ? groupId : null,
      });
      notify(editing ? "Data login berhasil diperbarui" : "User baru berhasil dibuat");
      setOpen(false);
      await refreshAccounts();
    } catch (error) { const message = error instanceof Error ? error.message : "Akun gagal disimpan"; setFormError(message); notify(message); }
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
    {role === "PJ Kelompok" ? <TeacherClassAssignmentPanel notify={notify} workspace={workspace} accounts={shownAccounts} previewMode={previewMode} /> : null}
    <div className="team-list">{shownAccounts.length ? shownAccounts.map((account) => <Member key={account.membership_id} account={account} scope={scopeName(account)} onEdit={() => openEdit(account)} onStatus={() => void setStatus(account)} onDelete={() => void remove(account)} />) : <EmptyState icon={<Users size={30} />} title="Belum ada anggota" text="Tekan tombol tambah untuk membuat username dan password baru." />}</div>
    {superView ? <><SectionTitle title="Riwayat aktivitas akun" /><div className="timeline">{activity.length ? activity.map((item) => <p key={item.id}><i />{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at))} <strong>{accounts.find((account) => account.user_id === item.actor_id)?.full_name ?? "Sistem"}</strong> {item.action === "user_login" ? "login" : item.action.replaceAll("_", " ")}</p>) : <p>Belum ada aktivitas login yang tercatat.</p>}</div></> : null}
    {open ? <div className="editor-overlay" role="dialog" aria-modal="true" aria-label={editing ? "Edit user" : "Tambah user"}><section className="editor-panel account-panel"><div className="editor-head"><div><span className="eyebrow">{editing ? "EDIT LOGIN" : "USER BARU"}</span><h2>{editing ? editing.full_name : "Buat akun langsung"}</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Tutup"><X size={19} /></button></div>
      <label className="field"><span>Nama lengkap</span><KeyboardInput value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
      <label className="field"><span>Username</span><KeyboardInput value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} /></label>
      <label className="field"><span>{editing ? "Password baru (kosongkan jika tetap)" : "Password awal — minimal 6 karakter"}</span><KeyboardInput value={password} onChange={(event) => { setPassword(event.target.value); setFormError(null); }} type="password" autoComplete="new-password" /></label>
      {!editing ? <><label className="field"><span>Tingkatan akses</span><select value={accountRole} onChange={(event) => setAccountRole(event.target.value as AccountRole)}>{availableRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
        {accountRole === "admin_daerah" ? <label className="field"><span>Daerah</span><select value={areaId} onChange={(event) => setAreaId(event.target.value)}>{workspace.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
        {accountRole === "admin_desa" ? <><label className="field"><span>Daerah</span><select value={areaId} onChange={(event) => setAreaId(event.target.value)}>{workspace.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Desa</span><select value={villageId} onChange={(event) => setVillageId(event.target.value)}>{visibleVillages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></> : null}
        {["pj_kelompok", "pengajar"].includes(accountRole) ? <><label className="field"><span>Desa</span><select value={villageId} onChange={(event) => setVillageId(event.target.value)}>{visibleVillages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Kelompok</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)}>{visibleGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></> : null}</> : <div className="account-scope-note"><strong>{roleLabels[editing.role]}</strong><span>{scopeName(editing)}</span></div>}
      {formError ? <div className="form-error" role="alert"><WarningCircle size={17} /><span>{formError}</span></div> : null}
      <button className="primary-button" disabled={saving} onClick={() => void submit()}>{saving ? "Membuat akun…" : editing ? "Simpan perubahan" : "Buat user"}</button>
    </section></div> : null}
  </>;
}

function Member({ account, scope, onEdit, onStatus, onDelete }: { account: WorkspaceAccount; scope: string; onEdit: () => void; onStatus: () => void; onDelete: () => void }) {
  const initials = account.full_name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const lastLogin = account.last_login_at ? `Login ${new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(account.last_login_at))}` : "Belum pernah login";
  return <article className="member-card"><Avatar initials={initials || "U"} muted={!account.is_active} /><span className="member-main"><strong>{account.full_name}</strong><small>@{account.username ?? "belum-diatur"} • {roleLabels[account.role]}</small><em>{scope} • {lastLogin}</em></span><span className={cx("status", account.is_active ? "success" : "warning")}>{account.is_active ? "Aktif" : "Nonaktif"}</span>{account.role !== "super_admin" ? <div className="member-actions"><button onClick={onEdit} aria-label={`Edit ${account.full_name}`}><PencilSimple size={16} /></button><button onClick={onStatus}>{account.is_active ? "Nonaktifkan" : "Aktifkan"}</button><button className="danger" onClick={onDelete} aria-label={`Hapus ${account.full_name}`}><Trash size={16} /></button></div> : null}</article>;
}

type OrgContactType = "area" | "village" | "group";
type OrgContact = { type: OrgContactType; id: string; name: string; subtitle: string; initials: string };
type OrgConversation = { id: string; scope_a_type: OrgContactType; scope_a_id: string; scope_b_type: OrgContactType; scope_b_id: string; updated_at: string };
type OrgMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type CurrentScope = { role: AccountRole; area_id: string | null; village_id: string | null; group_id: string | null };

function Chat({ notify, workspace, userId, previewMode, role }: { notify: (message: string) => void; workspace: WorkspaceData; userId?: string; previewMode: boolean; role: Role }) {
  const [scope, setScope] = useState<CurrentScope | null>(null);
  const [conversations, setConversations] = useState<OrgConversation[]>([]);
  const [messages, setMessages] = useState<OrgMessage[]>([]);
  const [selectedContact, setSelectedContact] = useState<OrgContact | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");

  const roleKey: Record<Role, AccountRole> = { "Super Admin": "super_admin", "Admin Daerah": "admin_daerah", "Admin Desa": "admin_desa", "PJ Kelompok": "pj_kelompok", "Pengajar": "pengajar" };

  const refreshChat = async (showLoading = true) => {
    if (previewMode || !supabase || !userId) return;
    if (showLoading) setLoading(true);
    try {
      const [membershipResult, conversationResult, messageResult] = await Promise.all([
        supabase.from("memberships").select("role,area_id,village_id,group_id").eq("user_id", userId).eq("role", roleKey[role]).eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("org_conversations").select("id,scope_a_type,scope_a_id,scope_b_type,scope_b_id,updated_at").order("updated_at", { ascending: false }),
        supabase.from("org_messages").select("id,conversation_id,sender_id,body,created_at").order("created_at", { ascending: true }),
      ]);
      if (membershipResult.error) throw membershipResult.error;
      if (conversationResult.error) throw conversationResult.error;
      if (messageResult.error) throw messageResult.error;
      setScope((membershipResult.data ?? null) as CurrentScope | null);
      setConversations((conversationResult.data ?? []) as OrgConversation[]);
      setMessages((messageResult.data ?? []) as OrgMessage[]);
    } catch (error) { notify(error instanceof Error ? error.message : "Komunikasi gagal dimuat"); }
    finally { if (showLoading) setLoading(false); }
  };

  useEffect(() => {
    if (previewMode) {
      setScope({ role: roleKey[role], area_id: workspace.areas[0]?.id ?? "demo-area", village_id: workspace.villages[0]?.id ?? "demo-village", group_id: workspace.groups[0]?.id ?? "demo-group" });
      return;
    }
    void refreshChat();
  }, [previewMode, userId, role]);

  useEffect(() => {
    if (previewMode || !supabase || !userId) return;
    const channel = supabase.channel(`one-pro-org-chat-${userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "org_messages" }, () => { void refreshChat(false); }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [previewMode, userId, role]);

  const contacts = useMemo<OrgContact[]>(() => {
    if (!scope) return [];
    const make = (type: OrgContactType, id: string, name: string, subtitle: string): OrgContact => ({ type, id, name, subtitle, initials: name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "OP" });
    if (role === "Admin Daerah") {
      const villages = workspace.villages.filter(v => !scope.area_id || v.area_id === scope.area_id);
      const villageIds = new Set(villages.map(v => v.id));
      return [
        ...villages.map(v => make("village", v.id, `Desa ${v.name}`, "Admin Desa")),
        ...workspace.groups.filter(g => villageIds.has(g.village_id)).map(g => make("group", g.id, `Kelompok ${g.name}`, "PJ Kelompok")),
      ];
    }
    if (role === "Admin Desa") {
      const village = workspace.villages.find(v => v.id === scope.village_id);
      const area = village ? workspace.areas.find(a => a.id === village.area_id) : null;
      return [
        ...(area ? [make("area", area.id, `Daerah ${area.name}`, "Admin Daerah")] : []),
        ...workspace.groups.filter(g => g.village_id === scope.village_id).map(g => make("group", g.id, `Kelompok ${g.name}`, "PJ Kelompok")),
      ];
    }
    if (role === "PJ Kelompok" || role === "Pengajar") {
      const group = workspace.groups.find(g => g.id === scope.group_id);
      const village = group ? workspace.villages.find(v => v.id === group.village_id) : null;
      const area = village ? workspace.areas.find(a => a.id === village.area_id) : null;
      return [
        ...(area ? [make("area", area.id, `Daerah ${area.name}`, "Admin Daerah")] : []),
        ...(village ? [make("village", village.id, `Desa ${village.name}`, "Admin Desa")] : []),
      ];
    }
    return [];
  }, [scope, role, workspace.areas, workspace.villages, workspace.groups]);

  const visibleContacts = contacts.filter(contact => `${contact.name} ${contact.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()));
  const conversationFor = (contact: OrgContact) => conversations.find(c => (c.scope_a_type === contact.type && c.scope_a_id === contact.id) || (c.scope_b_type === contact.type && c.scope_b_id === contact.id));
  const latestFor = (contact: OrgContact) => {
    const conversation = conversationFor(contact);
    if (!conversation) return null;
    const rows = messages.filter(message => message.conversation_id === conversation.id);
    return rows[rows.length - 1] ?? null;
  };
  const selectedMessages = selectedConversationId ? messages.filter(message => message.conversation_id === selectedConversationId) : [];

  const openContact = async (contact: OrgContact) => {
    setSelectedContact(contact);
    if (previewMode) { setSelectedConversationId(`preview-${contact.type}-${contact.id}`); return; }
    if (!supabase) return;
    const existing = conversationFor(contact);
    if (existing) { setSelectedConversationId(existing.id); return; }
    const { data, error } = await supabase.rpc("open_org_conversation", { p_target_type: contact.type, p_target_id: contact.id });
    if (error || !data) { notify(error?.message || "Percakapan tidak dapat dibuka"); return; }
    setSelectedConversationId(String(data));
    await refreshChat(false);
  };

  const send = async () => {
    const clean = body.trim();
    if (!clean || !selectedConversationId || !userId || sending) return;
    if (previewMode) { setBody(""); notify("Mode pratinjau: pesan siap dikirim pada akun nyata"); return; }
    if (!supabase) return;
    setSending(true);
    const { error } = await supabase.from("org_messages").insert({ conversation_id: selectedConversationId, sender_id: userId, body: clean });
    setSending(false);
    if (error) { notify(error.message); return; }
    setBody("");
    await refreshChat(false);
  };

  return <>
    <PageHeader title="Komunikasi" subtitle="Chat langsung antara Daerah, Desa, dan Kelompok" />
    <section className={cx("org-chat-shell", Boolean(selectedContact) && "has-selection")}>
      <aside className="org-contact-pane">
        <div className="org-contact-head"><div><ChatCircleDots size={21}/><span><strong>Kontak</strong><small>{contacts.length} unit tersedia</small></span></div></div>
        <label className="org-chat-search"><MagnifyingGlass size={16}/><KeyboardInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari desa atau kelompok"/></label>
        <div className="org-contact-list">{loading ? <div className="chat-empty">Memuat kontak…</div> : visibleContacts.length ? visibleContacts.map(contact => { const latest=latestFor(contact); const conversation=conversationFor(contact); return <button key={`${contact.type}-${contact.id}`} className={cx("org-contact-row",selectedContact?.type===contact.type&&selectedContact.id===contact.id&&"active")} onClick={() => void openContact(contact)}><span className="org-contact-avatar"><Buildings size={18}/></span><span className="org-contact-copy"><strong>{contact.name}</strong><small>{latest?.body || contact.subtitle}</small></span><em>{latest ? new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"}).format(new Date(latest.created_at)) : conversation ? "Aktif" : ""}</em></button>; }) : <div className="chat-empty">Tidak ada kontak pada lingkup akun ini.</div>}</div>
      </aside>
      <div className="org-conversation-pane">{selectedContact ? <>
        <header className="org-conversation-head"><button className="org-chat-back" onClick={() => { setSelectedContact(null); setSelectedConversationId(null); }} aria-label="Kembali ke kontak"><ArrowLeft size={20}/></button><span className="org-contact-avatar"><Buildings size={18}/></span><div><strong>{selectedContact.name}</strong><small>{selectedContact.subtitle} · online melalui One Pro</small></div></header>
        <div className="org-message-scroll">{selectedMessages.length ? selectedMessages.map(message => <article key={message.id} className={cx("org-bubble",message.sender_id===userId&&"mine")}><p>{message.body}</p><small>{message.sender_id===userId?"Anda · ":""}{new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(message.created_at))}</small></article>) : <div className="org-chat-welcome"><ChatCircleDots size={30}/><strong>Mulai percakapan</strong><p>Pesan ini langsung tersimpan di ONE PRO dan dapat dibalas oleh {selectedContact.name}.</p></div>}</div>
        <div className="org-chat-composer"><KeyboardInput value={body} onChange={event=>setBody(event.target.value)} placeholder={`Pesan ke ${selectedContact.name}`} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void send();}}}/><button disabled={sending||!body.trim()} onClick={()=>void send()} aria-label="Kirim pesan"><PaperPlaneTilt size={19} weight="fill"/></button></div>
      </> : <div className="org-chat-placeholder"><ChatCircleDots size={38}/><h2>Pilih kontak</h2><p>Pilih Daerah, Desa, atau Kelompok di sebelah kiri untuk membuka percakapan langsung.</p></div>}</div>
    </section>
  </>;
}

function ChatRow({ initials, title, message, time, unread }: { initials: string; title: string; message: string; time: string; unread?: string }) {
  return <button className="chat-row"><Avatar initials={initials} /><span><strong>{title}</strong><small>{message}</small></span><em>{time}{unread ? <b>{unread}</b> : null}</em></button>;
}

function Settings({ dark, setDark, notify, onSignOut, role, workspace }: { dark: boolean; setDark: (value: boolean) => void; notify: (message: string) => void; onSignOut: () => void; role: Role; workspace: WorkspaceData }) {
  const group = workspace.groups[0];
  const [profile, setProfile] = useState({ address: "", place: "", kyai: "", phone: "", notes: "" });
  const regionalRole = role === "Admin Daerah" || role === "Admin Desa";
  const scopeName = role === "Admin Daerah" ? (workspace.areas[0]?.name ?? "Daerah") : role === "Admin Desa" ? (workspace.villages[0]?.name ?? "Desa") : (group?.name ?? "Kelompok");
  const scopeType = role === "Admin Daerah" ? "Daerah" : role === "Admin Desa" ? "Desa" : "Kelompok";
  return <>
    <PageHeader title="Pengaturan" subtitle={regionalRole ? `Identitas akses dan preferensi tampilan ${scopeType.toLowerCase()}` : "Profil tempat dan identitas kelompok"} />
    {regionalRole ? <section className="data-card form-card">
      <div className="form-grid two">
        <label className="field"><span>Tingkat akses</span><KeyboardInput value={role} disabled /></label>
        <label className="field"><span>{scopeType}</span><KeyboardInput value={scopeName} disabled /></label>
        {role === "Admin Desa" ? <label className="field editor-wide"><span>Daerah induk</span><KeyboardInput value={workspace.areas[0]?.name ?? "—"} disabled /></label> : null}
      </div>
      <div className="info-callout"><Buildings size={18}/><span><strong>Struktur wilayah</strong><small>Tambah atau ubah {role === "Admin Daerah" ? "desa dan kelompok" : "kelompok"} melalui menu Wilayah. Data operasional kelompok tetap dikelola PJ Kelompok/Pengajar.</small></span></div>
    </section> : <section className="data-card form-card"><div className="form-grid two"><label className="field"><span>Nama kelompok</span><KeyboardInput value={group?.name ?? ""} disabled /></label><label className="field"><span>Nama Pak Yai / Pembina</span><KeyboardInput value={profile.kyai} onChange={e=>setProfile(v=>({...v,kyai:e.target.value}))}/></label><label className="field"><span>Tempat pengajian</span><KeyboardInput value={profile.place} onChange={e=>setProfile(v=>({...v,place:e.target.value}))}/></label><label className="field"><span>Nomor kontak kelompok</span><KeyboardInput value={profile.phone} onChange={e=>setProfile(v=>({...v,phone:e.target.value}))}/></label><label className="field editor-wide"><span>Alamat lengkap</span><KeyboardTextarea rows={3} value={profile.address} onChange={e=>setProfile(v=>({...v,address:e.target.value}))}/></label><label className="field editor-wide"><span>Catatan PJ kelompok</span><KeyboardTextarea rows={3} value={profile.notes} onChange={e=>setProfile(v=>({...v,notes:e.target.value}))}/></label></div>{role === "PJ Kelompok" ? <button className="primary-button" onClick={()=>notify("Profil kelompok berhasil disimpan")}><Check size={18}/>Simpan data kelompok</button> : <div className="info-callout"><WarningCircle size={18}/><span><strong>Akses lihat</strong><small>Perubahan profil kelompok dilakukan oleh PJ Kelompok.</small></span></div>}</section>}
    <section className="data-card settings-card"><label className="switch-row"><span><strong>Mode gelap</strong><small>Sesuaikan kenyamanan tampilan</small></span><button className={cx("switch", dark && "on")} onClick={() => setDark(!dark)}><span /></button></label></section>
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
