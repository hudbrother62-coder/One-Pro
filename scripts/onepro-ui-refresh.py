from pathlib import Path
import re

prototype_path = Path("src/Prototype.tsx")
css_path = Path("src/prototype.css")
agents_path = Path("AGENTS.md")
text = prototype_path.read_text()

operational = r'''function OperationalHome({ go, workspace, previewMode }: { go: (screen: Screen) => void; workspace: WorkspaceData; previewMode: boolean }) {
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
}'''

pattern = r'function OperationalHome\([\s\S]*?\n}\n\nfunction MonitoringHome'
text, count = re.subn(pattern, lambda _: operational + '\n\nfunction MonitoringHome', text, count=1)
if count != 1:
    raise SystemExit(f"OperationalHome replacement failed: {count}")

agenda = r'''function Agenda({ notify, go, workspace, refresh, userId, previewMode, canManage }: { notify: (message: string) => void; go: (screen: Screen) => void; workspace: WorkspaceData; refresh: () => Promise<void>; userId?: string; previewMode: boolean; canManage: boolean }) {
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
        return <button key={key} className={cx(activeDate===key&&"active",date.getMonth()!==calendarMonth.getMonth()&&"outside")} onClick={()=>setSelectedDate(key)} aria-label={new Intl.DateTimeFormat("id-ID",{dateStyle:"full"}).format(date)}>
          <span className="calendar-date-number">{date.getDate()}</span>
          {daySchedules.length ? <span className="calendar-agenda-preview">{daySchedules.slice(0,2).map((item) => { const klass = workspace.classes.find((candidate) => candidate.id === item.class_id); return <em key={item.id}>{klass?.name ?? "Agenda"}</em>; })}{daySchedules.length > 2 ? <small>+{daySchedules.length - 2}</small> : null}</span> : null}
        </button>;
      })}</div></div>
    </section>
    <SectionTitle title={`${schedules.length} agenda • ${new Intl.DateTimeFormat("id-ID",{dateStyle:"full"}).format(activeDay)}`} />
    {schedules.length ? <div className="schedule-list card-list">{schedules.map((item) => { const klass = workspace.classes.find((candidate) => candidate.id === item.class_id); return <div className="schedule-row-wrap" key={item.id}><Schedule time={item.start_time.slice(0, 5)} end={item.end_time.slice(0, 5)} title={klass?.name ?? "Kelas"} teacher={item.material_plan || "Materi belum diisi"} status="Terjadwal" tone="neutral" action={() => go("journal")} /><button className="icon-button" onClick={async () => { if (!previewMode) { await deleteSchedule(item.id); await refresh(); notify("Jadwal dinonaktifkan"); } }} aria-label="Nonaktifkan jadwal"><Trash size={16} /></button></div>; })}</div> : <EmptyState icon={<CalendarBlank size={30} />} title="Belum ada agenda" text="Tidak ada agenda yang terdaftar pada tanggal yang dipilih." />}
    {open ? <div className="editor-overlay" onMouseDown={(e)=>{if(e.target===e.currentTarget)setOpen(null)}} role="dialog" aria-modal="true" aria-label="Tambah jadwal"><section className="editor-panel"><div className="editor-head"><div><span className="eyebrow">JADWAL MENGAJI</span><h2>Tambah agenda</h2></div><button className="icon-button" onClick={() => setOpen(null)} aria-label="Tutup"><X size={19}/></button></div><label className="field"><span>Tanggal</span><KeyboardInput type="date" value={activeDate} onChange={(event)=>setSelectedDate(event.target.value)}/></label><label className="field"><span>Kelas</span><select value={classId} onChange={(event) => setClassId(event.target.value)}>{workspace.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="form-grid two"><label className="field"><span>Mulai</span><KeyboardInput type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="field"><span>Selesai</span><KeyboardInput type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div><label className="field"><span>Materi rencana</span><KeyboardTextarea value={materialPlan} onChange={(event) => setMaterialPlan(event.target.value)} rows={3} placeholder="Materi yang akan diajarkan" /></label><label className="switch-row"><span><strong>Jadikan jadwal rutin</strong><small>Berulang setiap minggu pada hari yang sama</small></span><span className="status success">Aktif</span></label><button className="primary-button" disabled={saving || !classId} onClick={() => void submitSchedule()}>{saving ? "Menyimpan…" : "Simpan agenda"}</button></section></div> : null}
  </>;
}'''

pattern = r'function Agenda\([\s\S]*?\n}\n\nfunction AttendanceScreen'
text, count = re.subn(pattern, lambda _: agenda + '\n\nfunction AttendanceScreen', text, count=1)
if count != 1:
    raise SystemExit(f"Agenda replacement failed: {count}")

prototype_path.write_text(text)

css = css_path.read_text()
marker = "/* dashboard-attendance-refresh-2026-09-17 */"
if marker not in css:
    css += r'''

/* dashboard-attendance-refresh-2026-09-17 */
.dashboard-summary-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
.summary-stat-card { min-width:0; min-height:118px; display:grid; align-content:center; gap:5px; padding:16px; text-align:left; color:var(--text); background:var(--surface); border:1px solid var(--line); border-radius:17px; cursor:pointer; }
.summary-stat-card:hover { border-color:color-mix(in srgb,var(--purple-2) 38%,var(--line)); background:color-mix(in srgb,var(--surface) 94%,var(--purple-2)); }
.summary-stat-card span { color:var(--muted); font-size:9px; font-weight:800; letter-spacing:.8px; }
.summary-stat-card strong { font-size:30px; line-height:1; color:var(--purple-2); letter-spacing:-1px; }
.summary-stat-card.attendance strong { color:var(--blue); }
.summary-stat-card small { color:var(--muted); font-size:9px; line-height:1.35; }
.attendance-dashboard-card { margin-top:14px; padding:18px; background:var(--surface); border:1px solid var(--line); border-radius:19px; }
.dashboard-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:18px; }
.dashboard-card-head h2 { margin:4px 0 0; font-size:17px; letter-spacing:-.4px; }
.dashboard-card-head > strong,.dashboard-card-head > small { color:var(--muted); font-size:9px; font-weight:700; text-transform:capitalize; }
.class-attendance-bars { display:grid; gap:14px; }
.class-attendance-row { display:grid; gap:7px; }
.class-attendance-meta { display:flex; justify-content:space-between; gap:12px; align-items:center; }
.class-attendance-meta span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; font-weight:700; }
.class-attendance-meta strong { font-size:10px; color:var(--blue); }
.class-attendance-track { height:10px; overflow:hidden; border-radius:999px; background:var(--surface-2); border:1px solid color-mix(in srgb,var(--line) 75%,transparent); }
.class-attendance-track span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--purple-2),var(--blue)); }
.month-trend-card { margin-top:14px; }
.month-trend-chart { height:220px; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; align-items:end; padding:10px 4px 0; }
.month-trend-item { min-width:0; height:100%; display:grid; grid-template-rows:24px 1fr 24px; justify-items:center; gap:6px; padding:7px 5px; border-radius:13px; }
.month-trend-item.current { background:color-mix(in srgb,var(--purple-2) 8%,var(--surface)); outline:1px solid color-mix(in srgb,var(--purple-2) 24%,var(--line)); }
.month-trend-item b { color:var(--text); font-size:9px; }
.month-trend-item > strong { color:var(--muted); font-size:8px; text-transform:capitalize; white-space:nowrap; }
.month-trend-bar { width:min(32px,70%); height:100%; display:flex; align-items:flex-end; overflow:hidden; border-radius:10px 10px 5px 5px; background:var(--surface-2); }
.month-trend-bar span { width:100%; min-height:0; border-radius:inherit; background:linear-gradient(180deg,var(--purple-2),var(--blue)); transition:height .25s ease; }
.month-trend-item.current .month-trend-bar span { background:linear-gradient(180deg,#8b168f,#075797); }
.dashboard-chart-note { margin:12px 0 0; color:var(--muted); font-size:8px; line-height:1.5; }
.agenda-calendar-shell { width:min(100%,760px); margin:0 0 16px; }
.agenda-calendar-shell .calendar-head { margin-bottom:8px; }
.agenda-calendar-shell .month-calendar { margin-bottom:0; padding:9px; }
.agenda-calendar-shell .calendar-grid { gap:4px; }
.agenda-calendar-shell .calendar-grid button { aspect-ratio:auto; min-height:58px; display:grid; align-content:start; justify-items:start; gap:4px; padding:7px; overflow:hidden; }
.calendar-date-number { font-size:10px; font-weight:800; line-height:1; }
.calendar-agenda-preview { width:100%; display:grid; gap:2px; text-align:left; }
.calendar-agenda-preview em { display:block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:2px 4px; border-radius:5px; color:var(--blue); background:color-mix(in srgb,var(--blue) 9%,var(--surface)); font-size:6.5px; font-style:normal; font-weight:700; line-height:1.15; }
.calendar-agenda-preview small { color:var(--muted); font-size:6px; font-weight:700; }
.agenda-calendar-shell .calendar-grid button.active .calendar-agenda-preview em { color:white; background:#ffffff20; }
.agenda-calendar-shell .calendar-grid button.active .calendar-agenda-preview small { color:#ffffffc9; }

@media (min-width:900px) {
  .dashboard-summary-grid { gap:16px; }
  .summary-stat-card { min-height:132px; padding:20px; }
  .summary-stat-card strong { font-size:38px; }
  .summary-stat-card span,.summary-stat-card small { font-size:10px; }
  .attendance-dashboard-card { padding:22px; }
  .class-attendance-meta span,.class-attendance-meta strong { font-size:11px; }
  .agenda-calendar-shell .calendar-grid button { min-height:68px; }
}

@media (max-width:560px) {
  .dashboard-summary-grid { gap:7px; }
  .summary-stat-card { min-height:100px; padding:11px 9px; border-radius:14px; }
  .summary-stat-card span { font-size:7px; letter-spacing:.45px; }
  .summary-stat-card strong { font-size:25px; }
  .summary-stat-card small { font-size:7px; }
  .attendance-dashboard-card { padding:14px; border-radius:16px; }
  .dashboard-card-head { margin-bottom:14px; }
  .dashboard-card-head h2 { font-size:14px; }
  .month-trend-chart { height:180px; gap:5px; }
  .month-trend-item { padding:5px 2px; }
  .month-trend-bar { width:min(24px,72%); }
  .agenda-calendar-shell .month-calendar { padding:7px; }
  .agenda-calendar-shell .calendar-weekdays,.agenda-calendar-shell .calendar-grid { gap:3px; }
  .agenda-calendar-shell .calendar-grid button { min-height:45px; padding:5px 4px; border-radius:8px; }
  .calendar-date-number { font-size:9px; }
  .calendar-agenda-preview { gap:1px; }
  .calendar-agenda-preview em { padding:1px 2px; font-size:5.8px; }
  .calendar-agenda-preview em:nth-of-type(n+2) { display:none; }
}
'''
    css_path.write_text(css)

agents = agents_path.read_text()
decision_marker = "## Dashboard and agenda decisions — 2026-09-17"
if decision_marker not in agents:
    agents += """

## Dashboard and agenda decisions — 2026-09-17

- Operational home for Pengajar/PJ Kelompok must not use hardcoded class-of-the-day cards or hardcoded attendance percentages.
- Top dashboard summary prioritizes active class count, total stored student count, and current-month attendance percentage from recorded attendance data.
- Dashboard includes current-month average attendance by class and a five-month attendance comparison with the current month centered between two prior and two following months.
- Agenda calendar stays compact, surfaces saved recurring agenda items inside the matching calendar dates, and the selected calendar date must stay synchronized with the agenda list below.
- Use local calendar dates for agenda selection; do not derive date keys with UTC `toISOString()` when that can shift the visible date in Indonesian time zones.
- These presentation changes must reuse the existing data model and must not require Supabase schema changes.
"""
    agents_path.write_text(agents)
