from pathlib import Path

proto = Path('src/Prototype.tsx')
s = proto.read_text()
anchor = 'import { AttendanceWorkspace, PptTemplateManager, StudentDatabaseHub } from "./operations-workspace";\n'
addition = anchor + 'import { ProfessionalWordReport } from "./word-report";\n'
if 'from "./word-report"' not in s:
    if anchor not in s: raise SystemExit('operations import anchor missing')
    s = s.replace(anchor, addition, 1)
s = s.replace('>Kelas & PPT</button>', '>Laporan Kelas</button>', 1)
old = '{tab === "individual" ? <><div className="report-actions"'
if old not in s: raise SystemExit('reports branch anchor missing')
old_class = ': <><PptTemplateManager notify={notify} workspace={workspace} previewMode={previewMode} /></>}'
new_class = ': <><ProfessionalWordReport notify={notify} workspace={workspace} month={month} previewMode={previewMode} /><PptTemplateManager notify={notify} workspace={workspace} previewMode={previewMode} /></>}'
if old_class in s:
    s = s.replace(old_class, new_class, 1)
elif '<ProfessionalWordReport notify={notify}' not in s:
    raise SystemExit('class report block missing')
proto.write_text(s)

ops = Path('src/operations-workspace.tsx')
o = ops.read_text()
o = o.replace('  const openMissing=(target:string)=>{setDate(target);setTab("fill");};\n', '')
card = '{missingDates.length?<div className="missing-attendance-card"><header><WarningCircle size={20}/><span><strong>Tanggal belum diisi</strong><small>Klik tanggal untuk langsung melengkapi presensi sebelumnya.</small></span></header><div>{missingDates.map(item=><button key={item} onClick={()=>openMissing(item)}>{new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",weekday:"short"}).format(new Date(`${item}T12:00:00`))}</button>)}</div></div>:<div className="complete-attendance-card"><CheckCircle size={18}/><span>Semua jadwal sampai hari ini sudah memiliki presensi.</span></div>}'
if card in o:
    o = o.replace(card, '', 1)
elif 'Tanggal belum diisi' in o:
    raise SystemExit('missing attendance card shape changed')
ops.write_text(o)

agents = Path('AGENTS.md')
a = agents.read_text()
line = '- Class reports provide a built-in professional ONE PRO Word template (`.docx`) in addition to optional user-uploaded PowerPoint templates. Word output uses the monthly journal analysis internally but never labels the report as AI-generated.\n'
if line not in a:
    heading = '## Class database, attendance recap, and report-template decisions — 2026-09-17\n'
    if heading in a:
        idx = a.index(heading) + len(heading)
        a = a[:idx] + '\n' + line + a[idx:]
    else:
        a += '\n' + line
    agents.write_text(a)
