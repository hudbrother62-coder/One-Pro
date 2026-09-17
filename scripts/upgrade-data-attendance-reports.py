from pathlib import Path

p=Path('src/Prototype.tsx')
s=p.read_text()

anchor='import { JournalWorkspace, MonthlyAiAnalysis, TeacherClassAssignmentPanel } from "./journal-workspace";\n'
addition=anchor+'import { AttendanceWorkspace, PptTemplateManager, StudentDatabaseHub } from "./operations-workspace";\n'
if 'from "./operations-workspace"' not in s:
    if anchor not in s: raise SystemExit('operations import anchor missing')
    s=s.replace(anchor,addition,1)

old='{screen === "attendance" ? <AttendanceScreen notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} /> : null}'
new='{screen === "attendance" ? <AttendanceWorkspace notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} role={role} /> : null}'
if old in s: s=s.replace(old,new,1)
elif '<AttendanceWorkspace notify={notify}' not in s: raise SystemExit('attendance screen anchor missing')

old='{screen === "students" ? <Students notify={notify} workspace={workspace} refresh={refreshWorkspace} previewMode={previewMode} /> : null}'
new='{screen === "students" ? <StudentDatabaseHub notify={notify} workspace={workspace} refresh={refreshWorkspace} role={role} previewMode={previewMode}><Students notify={notify} workspace={workspace} refresh={refreshWorkspace} previewMode={previewMode} /></StudentDatabaseHub> : null}'
if old in s: s=s.replace(old,new,1)
elif '<StudentDatabaseHub notify={notify}' not in s: raise SystemExit('students screen anchor missing')

# Reports: AI remains background intelligence, but is not presented as a visible feature.
s=s.replace('    <MonthlyAiAnalysis notify={notify} workspace={workspace} previewMode={previewMode} />\n','',1)

old='const download = (kind: "csv" | "print") => { if (kind === "print") { window.print(); return; }'
new='const download = async (kind: "csv" | "print") => { if (kind === "print") { if (!previewMode && supabase) { const classIds = classFilter === "all" ? workspace.classes.filter((item) => item.is_active).map((item) => item.id) : [classFilter]; await Promise.allSettled(classIds.map((classId) => supabase.functions.invoke("analyze-monthly-journal", { body: { classId, month } }))); } window.print(); return; }'
if old in s: s=s.replace(old,new,1)
elif 'const download = async (kind: "csv" | "print")' not in s: raise SystemExit('report download anchor missing')

s=s.replace('onClick={() => download("csv")}', 'onClick={() => void download("csv")}',1)
s=s.replace('onClick={() => download("print")}', 'onClick={() => void download("print")}',1)
s=s.replace('<DownloadSimple size={17} />Cetak / PDF','<DownloadSimple size={17} />Cetak',1)

old='<><section className="upload-card"><FilePpt size={34} /><h2>Template PowerPoint kelas</h2><p>Template PPTX dapat disiapkan per kelas. Data laporan diambil dari presensi dan jurnal yang tersimpan.</p><button className="secondary-button" onClick={() => notify("Unggah PPTX akan dihubungkan ke pemetaan template")}><UploadSimple size={17} />Unggah template PPTX</button></section><div className="action-list">{workspace.classes.map((klass) => <ActionRow key={klass.id} icon={<FilePpt />} title={klass.name} meta="Siapkan template kelas" badge="Atur" />)}</div></>'
new='<><PptTemplateManager notify={notify} workspace={workspace} previewMode={previewMode} /></>'
if old in s: s=s.replace(old,new,1)
elif '<PptTemplateManager notify={notify}' not in s: raise SystemExit('PPT block anchor missing')

# Add a print-only professional report masthead without exposing AI terminology.
needle='    <PageHeader title="Laporan" subtitle="Rekap presensi dan ketercapaian target bulanan" action={<label className="month-input"><span>Bulan</span><KeyboardInput type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>} />\n'
if needle in s and 'report-print-heading' not in s:
    s=s.replace(needle,needle+'    <div className="report-print-heading"><strong>ONE PRO JURNAL DIGITAL</strong><h1>Laporan Bulanan</h1><p>Rekap presensi dan perkembangan pembelajaran · {month}</p></div>\n',1)

p.write_text(s)

agents=Path('AGENTS.md')
a=agents.read_text()
marker='## Class database, attendance recap, and report-template decisions — 2026-09-17'
if marker not in a:
    a += '''\n\n## Class database, attendance recap, and report-template decisions — 2026-09-17\n\n- Database Anak has two views: Database Keseluruhan and Pembagian Kelas. The main student record remains the source of truth.\n- A student may have only one active class enrollment. Moving/removing a student closes the prior `class_enrollments` row with `ended_on`; never delete enrollment history just to change class.\n- PJ Kelompok manages class rosters and the lead Pengajar. A Pengajar can hold at most two classes. Journal and attendance should follow those assignments.\n- Attendance includes daily entry and monthly recap. Monthly recap must show scheduled sessions, completed attendance, journal completion, missing dates, per-student Hadir/Izin/Alpha, and attendance percentage. Past missing dates remain editable.\n- Report UI must not advertise AI. AI may prepare analysis in the background, but user-facing actions are ordinary report actions such as `Cetak`.\n- PPT reports are template-driven, not arbitrary AI slide rewriting. Store `.pptx` templates in the private `report-templates` bucket and map controlled placeholders such as class, month, attendance, summary, strengths, attention points, and recommendations.\n- Accept `.pptx` only, cap template size, preserve template versions, and validate placeholders/layout before automated PPT generation to avoid broken slides or fabricated content.\n'''
    agents.write_text(a)
