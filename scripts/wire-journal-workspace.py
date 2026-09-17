from pathlib import Path

path=Path('src/Prototype.tsx')
text=path.read_text()

anchor='import { BottomSheet, KeyboardInput, KeyboardTextarea, MobileScroll } from "./mobile";\n'
addition=anchor+'import { JournalWorkspace, MonthlyAiAnalysis, TeacherClassAssignmentPanel } from "./journal-workspace";\n'
if 'from "./journal-workspace"' not in text:
    if anchor not in text: raise SystemExit('journal import anchor missing')
    text=text.replace(anchor,addition,1)

old='{screen === "journal" ? <Journal notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} /> : null}'
new='{screen === "journal" ? <JournalWorkspace notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} role={role} /> : null}'
if old in text:
    text=text.replace(old,new,1)
elif '<JournalWorkspace notify={notify}' not in text:
    raise SystemExit('journal screen anchor missing')

old='<div className="segmented"><button className={cx(tab === "individual" && "active")} onClick={() => setTab("individual")}>Individu</button><button className={cx(tab === "class" && "active")} onClick={() => setTab("class")}>Kelas & PPT</button></div>\n'
new=old+'    <MonthlyAiAnalysis notify={notify} workspace={workspace} previewMode={previewMode} />\n'
if old in text and '<MonthlyAiAnalysis notify={notify}' not in text:
    text=text.replace(old,new,1)
elif '<MonthlyAiAnalysis notify={notify}' not in text:
    raise SystemExit('reports AI anchor missing')

old='    <div className="team-list">{shownAccounts.length ? shownAccounts.map((account) => <Member key={account.membership_id}'
new='    {role === "PJ Kelompok" ? <TeacherClassAssignmentPanel notify={notify} workspace={workspace} accounts={shownAccounts} previewMode={previewMode} /> : null}\n    <div className="team-list">{shownAccounts.length ? shownAccounts.map((account) => <Member key={account.membership_id}'
if old in text:
    text=text.replace(old,new,1)
elif '<TeacherClassAssignmentPanel notify={notify}' not in text:
    raise SystemExit('teacher assignment anchor missing')

path.write_text(text)

agents=Path('AGENTS.md')
a=agents.read_text()
section='''\n\n## Journal, teacher-class, and AI analysis decisions — 2026-09-17\n\n- PJ Kelompok assigns each Pengajar to a maximum of two active classes through `class_teachers`; Pengajar journal access is limited to assigned classes.\n- Keep two journal modes structurally distinct: `Pengajian / Kelas` records session-level delivery and class conditions, while `Individu Siswa` records per-student target progress, observation, rubric scores, and follow-up. Do not render both modes as the same form.\n- Journal scoring uses rubric version `one-pro-journal-v1`. Class session dimensions are material completion, class engagement, general understanding, and discipline/adab, each on a 1–4 scale. Individual dimensions are target progress, understanding, practice/skill, independence, and participation/adab, each on a 1–4 scale.\n- Individual progress is persisted in `student_progress`, linked to the daily journal and target when available. Historic journal and attendance data must never be deleted by this workflow.\n- Monthly AI analysis must use attendance, class journal entries, individual progress, and targets. The model must never invent facts; insufficient data must be called out explicitly. Persist generated analysis in `reports` and `ai_analyses` with a source hash for repeatability/cache.\n- Monthly AI output should include summary, strengths, attention points, students needing support, concrete next actions, class recommendations, next-month focus, and data-quality status.\n'''
if '## Journal, teacher-class, and AI analysis decisions — 2026-09-17' not in a:
    agents.write_text(a.rstrip()+section+'\n')
