import { useEffect, useMemo, useState } from "react";
import "@fontsource-variable/plus-jakarta-sans";
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

type Screen = "home" | "agenda" | "attendance" | "journal" | "students" | "targets" | "reports" | "team" | "chat" | "settings";
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
  { id: "team", label: "Tim & Akses", icon: Users, hint: "Anggota dan undangan" },
  { id: "chat", label: "Komunikasi", icon: Bell, hint: "Chat dan pengumuman" },
  { id: "settings", label: "Pengaturan", icon: Gear, hint: "Profil, AI, dan tema" },
];

const students = [
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

  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  const go = (next: Screen) => {
    setScreen(next);
    setMenuOpen(false);
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <div className={cx("one-pro-shell", dark && "is-dark")}>
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
        <main className="screen-content" data-testid="one-pro-app">
          {screen === "home" ? <Home role={role} setRole={setRole} go={go} /> : null}
          {screen === "agenda" ? <Agenda notify={notify} go={go} /> : null}
          {screen === "attendance" ? <AttendanceScreen notify={notify} /> : null}
          {screen === "journal" ? <Journal notify={notify} /> : null}
          {screen === "students" ? <Students notify={notify} /> : null}
          {screen === "targets" ? <Targets notify={notify} /> : null}
          {screen === "reports" ? <Reports notify={notify} /> : null}
          {screen === "team" ? <Team notify={notify} /> : null}
          {screen === "chat" ? <Chat notify={notify} /> : null}
          {screen === "settings" ? <Settings dark={dark} setDark={setDark} notify={notify} /> : null}
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
          {menuItems.map((item) => {
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

function Home({ role, setRole, go }: { role: Role; setRole: (role: Role) => void; go: (screen: Screen) => void }) {
  return <>
    <div className="context-row">
      <div><span className="eyebrow">MALANG TIMUR</span><h1>{role === "Pengajar" ? "Kelas hari ini" : role === "PJ Kelompok" ? "Mangliawan Utara" : "Pantauan wilayah"}</h1></div>
      <select value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label="Pratinjau peran">
        {(["Pengajar", "PJ Kelompok", "Admin Desa", "Admin Daerah", "Super Admin"] as Role[]).map((item) => <option key={item}>{item}</option>)}
      </select>
    </div>

    {role === "Pengajar" || role === "PJ Kelompok" ? <OperationalHome go={go} /> : <MonitoringHome role={role} go={go} />}
  </>;
}

function OperationalHome({ go }: { go: (screen: Screen) => void }) {
  return <>
    <section className="focus-panel">
      <div className="focus-head"><div><span>HARI INI</span><strong>3 kelas</strong><small>Senin, 14 September 2026</small></div><CalendarBlank size={27} /></div>
      <div className="schedule-list compact">
        <Schedule time="07.00" end="08.00" title="Tahsin Al-Qur'an" teacher="Ust. Ahmad Fauzi" status="Selesai" tone="success" />
        <Schedule time="16.00" end="17.30" title="Kelas Al-Fatihah" teacher="Ustaz Ahmad" status="Menunggu jurnal" tone="warning" action={() => go("journal")} />
        <Schedule time="18.30" end="19.30" title="Fiqih Dasar" teacher="Ustazah Siti" status="Akan dimulai" tone="neutral" />
      </div>
    </section>
    <section className="metric-strip" aria-label="Ringkasan kelompok">
      <Metric value="42" label="Siswa aktif" />
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

function MonitoringHome({ role, go }: { role: Role; go: (screen: Screen) => void }) {
  return <>
    <section className="progress-hero">
      <div><span>CAPAIAN TARGET</span><h2>78%</h2></div><div className="progress-copy"><strong>September 2026</strong><small>Naik 6% dari Agustus</small></div>
      <div className="progress-track"><span style={{ width: "78%" }} /></div>
    </section>
    <section className="metric-strip"><Metric value="486" label="Siswa aktif" /><Metric value="88%" label="Kehadiran" /><Metric value="16" label="Kelompok" /></section>
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

function AttendanceScreen({ notify }: { notify: (message: string) => void }) {
  const [records, setRecords] = useState<Record<number, Attendance>>({1:"H",2:"H",3:"I",4:"H"});
  const save = () => notify("Presensi 4 siswa berhasil disimpan");
  return <>
    <PageHeader title="Isi Presensi" subtitle="Kelas Al-Fatihah • 14 September 2026" />
    <div className="summary-line"><span><Clock size={17} />16.00–17.30</span><span>{Object.keys(records).length}/4 terisi</span></div>
    <div className="attendance-list">{students.filter((student) => student.active).slice(0,4).map((student) => <div className="attendance-row" key={student.id}><Avatar initials={student.initials} /><span><strong>{student.name}</strong><small>{student.grade}</small></span><div className="attendance-options">{(["H","I","A"] as Attendance[]).map((status) => <button key={status} className={cx(records[student.id] === status && "active", status === "A" && "absent")} onClick={() => setRecords((value) => ({...value,[student.id]:status}))}>{status}</button>)}</div></div>)}</div>
    <div className="legend"><span><i className="h" />Hadir</span><span><i className="i" />Izin</span><span><i className="a" />Alfa</span></div>
    <button className="primary-button" onClick={save}><Check size={18} />Simpan presensi</button>
  </>;
}

function Journal({ notify }: { notify: (message: string) => void }) {
  const [progress, setProgress] = useState(false);
  return <>
    <PageHeader title="Jurnal Harian" subtitle="Kelas Al-Fatihah • Senin, 14 September" />
    <section className="data-card form-card">
      <div className="form-grid two"><Field label="Jam mulai" value="16.00" /><Field label="Jam selesai" value="17.30" /></div>
      <TextArea label="Materi yang disampaikan" placeholder="Tuliskan materi hari ini" />
      <TextArea label="Capaian dan kendala" placeholder="Apa yang tercapai atau perlu diperbaiki?" />
      <label className="switch-row"><span><strong>Catat progres individu</strong><small>Opsional, pilih hanya anak yang diamati</small></span><button className={cx("switch", progress && "on")} onClick={() => setProgress((value) => !value)} aria-label="Catat progres individu"><span /></button></label>
      {progress ? <div className="progress-entry"><div className="student-mini"><Avatar initials="AF" /><span><strong>Ahmad Fauzan</strong><small>Target: Mengenal huruf hijaiyah</small></span></div><div className="chip-row">{["Mulai","Berkembang","Perlu penguatan","Tercapai"].map((item, index) => <button key={item} className={cx(index === 1 && "active")}>{item}</button>)}</div><TextArea label="Catatan pengamatan" placeholder="Contoh: masih tertukar huruf ba dan ta" /></div> : null}
    </section>
    <button className="primary-button" onClick={() => notify("Jurnal berhasil disimpan dan rekap diperbarui")}><Check size={18} />Simpan jurnal</button>
  </>;
}

function Students({ notify }: { notify: (message: string) => void }) {
  const [showPhotos, setShowPhotos] = useState(true);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => students.filter((student) => student.name.toLowerCase().includes(query.toLowerCase())), [query]);
  return <>
    <PageHeader title="Database Anak" subtitle="42 aktif • 3 nonaktif" action={<button className="primary-icon" onClick={() => notify("Form anak baru dibuka")}><Plus size={20} /></button>} />
    <div className="toolbar"><label className="search"><MagnifyingGlass size={17} /><KeyboardInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama anak" /></label><button className={cx("photo-toggle", showPhotos && "active")} onClick={() => setShowPhotos((value) => !value)}><UserCircle size={18} />Foto</button></div>
    <div className="student-list">{filtered.map((student) => <button className="student-row" key={student.id}>{showPhotos ? <Avatar initials={student.initials} muted={!student.active} /> : null}<span><strong>{student.name}</strong><small>{student.grade} • {student.active ? "Aktif" : "Nonaktif — riwayat tersimpan"}</small></span><PencilSimple size={17} /></button>)}</div>
    <div className="split-actions"><button className="secondary-button" onClick={() => notify("Template Excel siap diunduh")}><DownloadSimple size={17} />Template</button><button className="secondary-button" onClick={() => notify("Pilih file Excel untuk diimpor")}><UploadSimple size={17} />Import</button></div>
  </>;
}

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

function Team({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageHeader title="Tim & Akses" subtitle="7 anggota aktif di Mangliawan Utara" action={<button className="primary-icon" onClick={() => notify("Link undangan berhasil dibuat")}><Plus size={20} /></button>} />
    <div className="team-list"><Member initials="AS" name="Ahmad Syafi'i" role="Penanggung Jawab Kelompok" status="Aktif sekarang" /><Member initials="SF" name="Siti Fatimah" role="Pengajar • Kelas Al-Fatihah" status="Login 18.42" /><Member initials="BR" name="Budi Rahman" role="Pengajar • Fiqih Dasar" status="Login kemarin" /></div>
    <SectionTitle title="Aktivitas terbaru" />
    <div className="timeline"><p><i />18.42 <strong>Siti Fatimah</strong> mengisi presensi</p><p><i />17.58 <strong>Ahmad Syafi'i</strong> mengubah jadwal</p><p><i />16.30 <strong>Budi Rahman</strong> login</p></div>
  </>;
}

function Member({ initials, name, role, status }: { initials: string; name: string; role: string; status: string }) {
  return <button className="student-row"><Avatar initials={initials} /><span><strong>{name}</strong><small>{role}</small><em>{status}</em></span><CaretRight size={17} /></button>;
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

function Settings({ dark, setDark, notify }: { dark: boolean; setDark: (value: boolean) => void; notify: (message: string) => void }) {
  return <>
    <PageHeader title="Pengaturan" subtitle="Akun dan sistem One Pro" />
    <section className="data-card settings-card"><label className="switch-row"><span><strong>Mode gelap</strong><small>Sesuaikan kenyamanan tampilan</small></span><button className={cx("switch", dark && "on")} onClick={() => setDark(!dark)}><span /></button></label><ActionRow icon={<Bell />} title="Notifikasi HP" meta="Jadwal dan pengingat pukul 20.00" badge="Aktif" /><ActionRow icon={<Gear />} title="Gemini AI" meta="3 API key • rotasi otomatis" badge="Admin" /><ActionRow icon={<Database />} title="Penyimpanan" meta="Foto anak dan template PPTX" /></section>
    <button className="danger-button" onClick={() => notify("Anda berhasil keluar dari akun")}><SignOut size={18} />Keluar akun</button>
  </>;
}

function Field({ label, value }: { label: string; value?: string }) { return <label className="field"><span>{label}</span><KeyboardInput defaultValue={value} /></label>; }
function TextArea({ label, placeholder }: { label: string; placeholder: string }) { return <label className="field"><span>{label}</span><KeyboardTextarea placeholder={placeholder} rows={3} /></label>; }
function Avatar({ initials, muted }: { initials: string; muted?: boolean }) { return <span className={cx("avatar", muted && "muted")}>{initials}</span>; }
function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state">{icon}<strong>{title}</strong><p>{text}</p></div>; }
