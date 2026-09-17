import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarBlank, Check, CheckCircle, FilePpt, Plus, Student, UploadSimple, Users, WarningCircle, X } from "@phosphor-icons/react";
import { supabase } from "./lib/supabase";
import { loadAccounts, loadAttendanceSummary, saveAttendance, saveClass, type AccountRole, type WorkspaceAccount, type WorkspaceData } from "./lib/data";
import { KeyboardInput } from "./mobile";
import "./operations-workspace.css";

type Role = "Pengajar" | "PJ Kelompok" | "Admin Desa" | "Admin Daerah" | "Super Admin";
type Attendance = "H" | "I" | "A";
type AttendanceRow = { student_id: string; status: "hadir" | "izin" | "alpha"; session_date: string; class_id: string };
type SessionRow = { id: string; class_id: string; session_date: string; submitted_at: string | null };
type JournalRow = { class_id: string; journal_date: string };
type TeacherLink = { class_id: string; user_id: string; is_lead: boolean };
type TemplateRow = { id: string; class_id: string | null; owner_id: string; name: string; file_path: string; field_map: Record<string, unknown>; is_active: boolean; created_at: string };

const roleToKey: Record<Role, AccountRole> = { "Super Admin": "super_admin", "Admin Daerah": "admin_daerah", "Admin Desa": "admin_desa", "PJ Kelompok": "pj_kelompok", "Pengajar": "pengajar" };
function cx(...names: Array<string | false | undefined>) { return names.filter(Boolean).join(" "); }
function localToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function monthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const total = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: total }, (_, index) => new Date(year, monthNumber - 1, index + 1));
}
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase(); }

export function StudentDatabaseHub({ children, notify, workspace, refresh, role, previewMode }: { children: ReactNode; notify: (message: string) => void; workspace: WorkspaceData; refresh: () => Promise<void>; role: Role; previewMode: boolean }) {
  const [tab, setTab] = useState<"all" | "classes">("all");
  return <>
    <div className="database-view-tabs" role="tablist"><button className={cx(tab === "all" && "active")} onClick={() => setTab("all")}>Database Keseluruhan</button><button className={cx(tab === "classes" && "active")} onClick={() => setTab("classes")}>Pembagian Kelas</button></div>
    {tab === "all" ? children : <ClassDatabase notify={notify} workspace={workspace} refresh={refresh} role={role} previewMode={previewMode} />}
  </>;
}

function ClassDatabase({ notify, workspace, refresh, role, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; refresh: () => Promise<void>; role: Role; previewMode: boolean }) {
  const canManage = role === "PJ Kelompok";
  const [selectedClassId, setSelectedClassId] = useState(workspace.classes.find(item => item.is_active)?.id ?? "");
  const [roster, setRoster] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<WorkspaceAccount[]>([]);
  const [teacherLinks, setTeacherLinks] = useState<TeacherLink[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [saving, setSaving] = useState(false);
  const [newClassOpen, setNewClassOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const selectedClass = workspace.classes.find(item => item.id === selectedClassId);

  const reloadLinks = async () => {
    if (previewMode || !supabase) return;
    const [accountRows, links] = await Promise.all([loadAccounts(), supabase.from("class_teachers").select("class_id,user_id,is_lead")]);
    if (links.error) throw links.error;
    setAccounts(accountRows.accounts);
    setTeacherLinks((links.data ?? []) as TeacherLink[]);
  };
  useEffect(() => { void reloadLinks().catch(error => notify(error instanceof Error ? error.message : "Data guru gagal dimuat")); }, [previewMode, workspace.classes.length]);
  useEffect(() => {
    if (!selectedClassId && workspace.classes[0]) setSelectedClassId(workspace.classes[0].id);
    const current = workspace.enrollments.filter(item => item.class_id === selectedClassId && !item.ended_on).map(item => item.student_id);
    setRoster(current);
    const lead = teacherLinks.find(item => item.class_id === selectedClassId && item.is_lead);
    setTeacherId(lead?.user_id ?? "");
  }, [selectedClassId, workspace.enrollments, teacherLinks, workspace.classes]);

  const currentEnrollmentByStudent = useMemo(() => new Map(workspace.enrollments.filter(item => !item.ended_on).map(item => [item.student_id, item.class_id])), [workspace.enrollments]);
  const candidates = workspace.students.filter(student => student.status === "active" && (!selectedClass?.group_id || student.group_id === selectedClass.group_id));
  const teachers = accounts.filter(account => account.role === "pengajar" && account.is_active && (!selectedClass?.group_id || account.group_id === selectedClass.group_id));
  const teacherCount = (userId: string) => new Set(teacherLinks.filter(item => item.user_id === userId && item.class_id !== selectedClassId).map(item => item.class_id)).size;

  const toggleStudent = (studentId: string) => {
    const otherClass = currentEnrollmentByStudent.get(studentId);
    if (otherClass && otherClass !== selectedClassId) { notify("Anak ini sudah terdaftar pada kelas aktif lain"); return; }
    setRoster(current => current.includes(studentId) ? current.filter(id => id !== studentId) : [...current, studentId]);
  };
  const saveRoster = async () => {
    if (!selectedClassId) return;
    if (previewMode) { notify("Pembagian siswa siap disimpan pada data nyata"); return; }
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_class_roster", { p_class_id: selectedClassId, p_student_ids: roster });
    if (!error) {
      const teacherResult = await supabase.rpc("set_class_lead_teacher", { p_class_id: selectedClassId, p_user_id: teacherId || null });
      if (teacherResult.error) { setSaving(false); notify(teacherResult.error.message); return; }
      await refresh(); await reloadLinks(); notify("Pembagian kelas dan guru berhasil disimpan");
    } else notify(error.message);
    setSaving(false);
  };
  const addClass = async () => {
    if (!className.trim()) return;
    if (previewMode) { notify("Mode pratinjau: kelas siap dibuat"); setNewClassOpen(false); return; }
    const groupId = workspace.groups[0]?.id;
    if (!groupId) { notify("Kelompok belum tersedia"); return; }
    setSaving(true);
    try { await saveClass({ groupId, name: className, description: classDescription }); await refresh(); setClassName(""); setClassDescription(""); setNewClassOpen(false); notify("Kelas baru berhasil dibuat"); }
    catch (error) { notify(error instanceof Error ? error.message : "Kelas gagal dibuat"); }
    finally { setSaving(false); }
  };

  return <section className="class-database-workspace">
    <div className="workspace-heading"><div><span>DATABASE KELAS</span><h1>Pembagian Kelas</h1><p>Satu anak hanya dapat berada pada satu kelas aktif. PJ Kelompok menentukan siswa dan guru penanggung jawab.</p></div>{canManage ? <button className="workspace-add" onClick={() => setNewClassOpen(true)}><Plus size={18}/>Tambah kelas</button> : null}</div>
    <div className="class-workspace-grid">
      <aside className="class-card-list">{workspace.classes.filter(item=>item.is_active).map(klass => { const count=workspace.enrollments.filter(item=>item.class_id===klass.id&&!item.ended_on).length; const lead=teacherLinks.find(item=>item.class_id===klass.id&&item.is_lead); const teacher=accounts.find(item=>item.user_id===lead?.user_id); return <button key={klass.id} className={cx(selectedClassId===klass.id&&"active")} onClick={()=>setSelectedClassId(klass.id)}><span className="class-card-icon"><Users size={18}/></span><span><strong>{klass.name}</strong><small>{count} siswa · {teacher?.full_name || "Guru belum ditetapkan"}</small></span></button>; })}{!workspace.classes.length ? <div className="class-empty">Belum ada kelas.</div> : null}</aside>
      <div className="class-roster-panel">{selectedClass ? <><header><div><span>KELAS AKTIF</span><h2>{selectedClass.name}</h2></div><b>{roster.length} siswa</b></header>
        <label className="class-teacher-field"><span>Guru penanggung jawab</span><select value={teacherId} disabled={!canManage} onChange={event=>setTeacherId(event.target.value)}><option value="">Belum ditentukan</option>{teachers.map(teacher=><option key={teacher.user_id} value={teacher.user_id} disabled={teacherCount(teacher.user_id)>=2}>{teacher.full_name}{teacherCount(teacher.user_id)>=2?" · sudah 2 kelas":""}</option>)}</select><small>Setiap guru maksimal memegang 2 kelas.</small></label>
        <div className="roster-list"><div className="roster-list-head"><strong>Pilih siswa dari database utama</strong><small>{candidates.length} siswa aktif di kelompok</small></div>{candidates.map(student=>{ const activeClassId=currentEnrollmentByStudent.get(student.id); const locked=Boolean(activeClassId&&activeClassId!==selectedClassId); const other=workspace.classes.find(item=>item.id===activeClassId); return <label key={student.id} className={cx("roster-row",locked&&"locked")}><input type="checkbox" checked={roster.includes(student.id)} disabled={!canManage||locked} onChange={()=>toggleStudent(student.id)}/><span className="roster-avatar">{initials(student.full_name)}</span><span><strong>{student.full_name}</strong><small>{locked?`Sudah di ${other?.name||"kelas lain"}`:"Tersedia untuk kelas ini"}</small></span>{locked?<em>Terkunci</em>:null}</label>; })}</div>
        {canManage ? <button className="save-class-roster" disabled={saving} onClick={()=>void saveRoster()}><Check size={18}/>{saving?"Menyimpan…":"Simpan pembagian kelas"}</button> : null}</> : <div className="class-empty">Pilih kelas terlebih dahulu.</div>}</div>
    </div>
    {newClassOpen ? <div className="ops-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setNewClassOpen(false)}}><section className="ops-modal"><header><div><span>KELAS BARU</span><h2>Tambah kelas</h2></div><button onClick={()=>setNewClassOpen(false)}><X size={18}/></button></header><label><span>Nama kelas</span><KeyboardInput value={className} onChange={event=>setClassName(event.target.value)} placeholder="Contoh: Kelas Tilawati A"/></label><label><span>Keterangan</span><KeyboardInput value={classDescription} onChange={event=>setClassDescription(event.target.value)} placeholder="Opsional"/></label><button className="save-class-roster" disabled={saving||!className.trim()} onClick={()=>void addClass()}>{saving?"Menyimpan…":"Buat kelas"}</button></section></div> : null}
  </section>;
}

export function AttendanceWorkspace({ notify, workspace, userId, previewMode, role }: { notify: (message: string) => void; workspace: WorkspaceData; userId?: string; previewMode: boolean; role: Role }) {
  const [tab, setTab] = useState<"fill"|"recap">("fill");
  const [classId, setClassId] = useState(workspace.classes[0]?.id ?? "");
  const [date, setDate] = useState(localToday());
  const [month, setMonth] = useState(localToday().slice(0,7));
  const [records, setRecords] = useState<Record<string,Attendance>>({});
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [allowedClassIds, setAllowedClassIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    if (previewMode || !supabase) return;
    const [summary, sessionRows, journalRows, teacherRows] = await Promise.all([
      loadAttendanceSummary(),
      supabase.from("attendance_sessions").select("id,class_id,session_date,submitted_at").order("session_date",{ascending:false}),
      supabase.from("daily_journals").select("class_id,journal_date").order("journal_date",{ascending:false}),
      userId && role === "Pengajar" ? supabase.from("class_teachers").select("class_id").eq("user_id",userId) : Promise.resolve({data:[],error:null}),
    ]);
    if (sessionRows.error) throw sessionRows.error; if (journalRows.error) throw journalRows.error; if (teacherRows.error) throw teacherRows.error;
    setAttendance(summary); setSessions((sessionRows.data??[]) as SessionRow[]); setJournals((journalRows.data??[]) as JournalRow[]); setAllowedClassIds((teacherRows.data??[]).map(row=>row.class_id as string));
  };
  useEffect(()=>{void reload().catch(error=>notify(error instanceof Error?error.message:"Rekap presensi gagal dimuat"));},[previewMode,userId,role]);
  const visibleClasses=workspace.classes.filter(item=>item.is_active&&(role!=="Pengajar"||previewMode||allowedClassIds.includes(item.id)));
  useEffect(()=>{if(!classId&&visibleClasses[0])setClassId(visibleClasses[0].id);if(classId&&!visibleClasses.some(item=>item.id===classId))setClassId(visibleClasses[0]?.id??"");},[classId,visibleClasses]);
  const studentIds=new Set(workspace.enrollments.filter(item=>item.class_id===classId&&!item.ended_on).map(item=>item.student_id));
  const students=workspace.students.filter(student=>student.status==="active"&&studentIds.has(student.id));
  useEffect(()=>{ const existing=attendance.filter(row=>row.class_id===classId&&row.session_date===date); const next:Record<string,Attendance>={}; for(const student of students){ const row=existing.find(item=>item.student_id===student.id); next[student.id]=row?.status==="izin"?"I":row?.status==="alpha"?"A":"H"; } setRecords(next); },[classId,date,attendance,workspace.enrollments]);
  const submit=async()=>{ if(!classId||!userId||!students.length)return; if(previewMode){notify("Mode pratinjau: presensi siap disimpan");return;} setSaving(true);try{await saveAttendance({classId,date,userId,records:students.map(student=>({studentId:student.id,status:records[student.id]==="I"?"izin":records[student.id]==="A"?"alpha":"hadir"}))});await reload();notify("Presensi tersimpan");}catch(error){notify(error instanceof Error?error.message:"Presensi gagal disimpan");}finally{setSaving(false);}};

  const monthAttendance=attendance.filter(row=>row.class_id===classId&&row.session_date.startsWith(month));
  const monthSessions=sessions.filter(row=>row.class_id===classId&&row.session_date.startsWith(month));
  const monthJournals=journals.filter(row=>row.class_id===classId&&row.journal_date.startsWith(month));
  const scheduleWeekdays=new Set(workspace.schedules.filter(item=>item.class_id===classId&&item.is_active).map(item=>item.weekday));
  const expectedDates=monthDays(month).filter(day=>scheduleWeekdays.has(day.getDay())&&dateKey(day)<=localToday()).map(dateKey);
  const submittedDates=new Set(monthSessions.filter(row=>row.submitted_at).map(row=>row.session_date));
  const journalDates=new Set(monthJournals.map(row=>row.journal_date));
  const missingDates=expectedDates.filter(item=>!submittedDates.has(item));
  const perStudent=students.map(student=>{const rows=monthAttendance.filter(row=>row.student_id===student.id);const hadir=rows.filter(row=>row.status==="hadir").length;const izin=rows.filter(row=>row.status==="izin").length;const alpha=rows.filter(row=>row.status==="alpha").length;return{student,hadir,izin,alpha,total:rows.length,percent:rows.length?Math.round(hadir/rows.length*100):0};});
  const totalRecorded=monthAttendance.length; const totalPresent=monthAttendance.filter(row=>row.status==="hadir").length; const avg=totalRecorded?Math.round(totalPresent/totalRecorded*100):0;
  const openMissing=(target:string)=>{setDate(target);setTab("fill");};

  return <>
    <div className="attendance-page-head"><div><span>PRESENSI KELAS</span><h1>Presensi & Rekap</h1><p>Isi presensi harian dan pantau kelengkapan satu bulan.</p></div></div>
    <div className="ops-tabs"><button className={cx(tab==="fill"&&"active")} onClick={()=>setTab("fill")}>Isi Presensi</button><button className={cx(tab==="recap"&&"active")} onClick={()=>setTab("recap")}>Rekap Bulanan</button></div>
    {tab==="fill"?<section className="attendance-fill-card"><div className="attendance-controls-pro"><label><span>Kelas</span><select value={classId} onChange={event=>setClassId(event.target.value)}>{visibleClasses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Tanggal</span><KeyboardInput type="date" value={date} max={localToday()} onChange={event=>setDate(event.target.value)}/></label></div><div className="attendance-student-list">{students.map(student=><article key={student.id}><span className="roster-avatar">{initials(student.full_name)}</span><span><strong>{student.full_name}</strong><small>{date}</small></span><div className="attendance-choice">{(["H","I","A"] as Attendance[]).map(value=><button key={value} className={cx(records[student.id]===value&&"active",value==="A"&&"danger")} onClick={()=>setRecords(current=>({...current,[student.id]:value}))}>{value}</button>)}</div></article>)}{!students.length?<div className="class-empty">Belum ada siswa pada kelas ini.</div>:null}</div><button className="save-class-roster" disabled={saving||!students.length} onClick={()=>void submit()}><Check size={18}/>{saving?"Menyimpan…":"Simpan presensi"}</button></section>:<section className="attendance-recap-workspace"><div className="attendance-recap-filters"><label><span>Kelas</span><select value={classId} onChange={event=>setClassId(event.target.value)}>{visibleClasses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Bulan</span><KeyboardInput type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label></div><div className="recap-metrics"><article><strong>{expectedDates.length}</strong><span>Jadwal pengajian</span></article><article><strong>{submittedDates.size}</strong><span>Presensi terisi</span></article><article><strong>{journalDates.size}</strong><span>Jurnal terisi</span></article><article className={missingDates.length?"warning":"success"}><strong>{missingDates.length}</strong><span>Belum diisi</span></article><article><strong>{avg}%</strong><span>Rata-rata hadir</span></article></div>{missingDates.length?<div className="missing-attendance-card"><header><WarningCircle size={20}/><span><strong>Tanggal belum diisi</strong><small>Klik tanggal untuk langsung melengkapi presensi sebelumnya.</small></span></header><div>{missingDates.map(item=><button key={item} onClick={()=>openMissing(item)}>{new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",weekday:"short"}).format(new Date(`${item}T12:00:00`))}</button>)}</div></div>:<div className="complete-attendance-card"><CheckCircle size={18}/><span>Semua jadwal sampai hari ini sudah memiliki presensi.</span></div>}<div className="individual-recap-table"><div className="individual-recap-head"><strong>Rekap per individu</strong><small>Hadir, izin, alpha, dan persentase bulan terpilih.</small></div>{perStudent.map(item=><article key={item.student.id}><span className="roster-avatar">{initials(item.student.full_name)}</span><span className="person-name"><strong>{item.student.full_name}</strong><small>{item.total} catatan presensi</small></span><span><b>{item.hadir}</b><small>Hadir</small></span><span><b>{item.izin}</b><small>Izin</small></span><span><b>{item.alpha}</b><small>Alpha</small></span><span className="presence-rate"><b>{item.percent}%</b><small>Rata-rata</small></span></article>)}</div></section>}
  </>;
}

export function PptTemplateManager({ notify, workspace, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; previewMode: boolean }) {
  const inputRef=useRef<HTMLInputElement|null>(null);
  const [classId,setClassId]=useState(workspace.classes[0]?.id??"");
  const [templates,setTemplates]=useState<TemplateRow[]>([]);
  const [uploading,setUploading]=useState(false);
  const load=async()=>{if(previewMode||!supabase)return;const{data,error}=await supabase.from("report_templates").select("id,class_id,owner_id,name,file_path,field_map,is_active,created_at").eq("is_active",true).order("created_at",{ascending:false});if(error)throw error;setTemplates((data??[]) as TemplateRow[]);};
  useEffect(()=>{void load().catch(error=>notify(error instanceof Error?error.message:"Template PPT gagal dimuat"));},[previewMode,workspace.classes.length]);
  useEffect(()=>{if(!classId&&workspace.classes[0])setClassId(workspace.classes[0].id);},[classId,workspace.classes]);
  const upload=async(file:File)=>{if(!classId)return;if(file.size>15*1024*1024){notify("Ukuran template maksimal 15 MB");return;}if(!file.name.toLowerCase().endsWith(".pptx")){notify("Gunakan file .pptx tanpa macro");return;}if(previewMode){notify("Mode pratinjau: template PPTX siap diunggah");return;}if(!supabase)return;setUploading(true);try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError||!userData.user)throw userError||new Error("Sesi login tidak ditemukan");const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-");const path=`${userData.user.id}/${classId}/${Date.now()}-${safe}`;const uploaded=await supabase.storage.from("report-templates").upload(path,file,{contentType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",upsert:false});if(uploaded.error)throw uploaded.error;await supabase.from("report_templates").update({is_active:false}).eq("class_id",classId).eq("owner_id",userData.user.id);const fieldMap={version:"one-pro-ppt-v1",placeholders:["{{NAMA_KELAS}}","{{BULAN}}","{{TOTAL_SISWA}}","{{RATA_KEHADIRAN}}","{{RINGKASAN}}","{{KEKUATAN}}","{{PERLU_PERHATIAN}}","{{REKOMENDASI}}"],requirements:{format:"pptx",aspect_ratio:"16:9",max_narrative_chars:650}};const row=await supabase.from("report_templates").insert({class_id:classId,owner_id:userData.user.id,name:file.name,file_path:path,field_map:fieldMap,is_active:true});if(row.error){await supabase.storage.from("report-templates").remove([path]);throw row.error;}await load();notify("Template PPT berhasil disimpan");}catch(error){notify(error instanceof Error?error.message:"Template PPT gagal diunggah");}finally{setUploading(false);if(inputRef.current)inputRef.current.value="";}};
  const active=templates.find(item=>item.class_id===classId);
  return <section className="ppt-template-manager"><header><span className="ppt-icon"><FilePpt size={24}/></span><div><h2>Template PowerPoint Laporan</h2><p>Unggah template 16:9 untuk kelas. Sistem menyimpan template dan data pemetaan laporan secara terstruktur.</p></div></header><div className="ppt-template-controls"><label><span>Kelas</span><select value={classId} onChange={event=>setClassId(event.target.value)}>{workspace.classes.filter(item=>item.is_active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="template-status"><strong>{active?active.name:"Belum ada template"}</strong><small>{active?"Template aktif untuk kelas ini":"Unggah file .pptx maksimal 15 MB"}</small></div></div><input ref={inputRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);}}/><button className="template-upload-button" disabled={uploading||!classId} onClick={()=>inputRef.current?.click()}><UploadSimple size={18}/>{uploading?"Mengunggah…":active?"Ganti template PPTX":"Unggah template PPTX"}</button><div className="ppt-template-note"><strong>Standar template ONE PRO</strong><p>Gunakan placeholder seperti {{NAMA_KELAS}}, {{BULAN}}, {{RATA_KEHADIRAN}}, {{RINGKASAN}}, {{KEKUATAN}}, dan {{REKOMENDASI}}. Template kompleks tetap divalidasi sebelum generator PPT diaktifkan.</p></div></section>;
}
