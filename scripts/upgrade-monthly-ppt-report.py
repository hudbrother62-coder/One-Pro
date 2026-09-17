from pathlib import Path

ppt = r'''import { useState } from "react";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { DownloadSimple, FilePpt, PresentationChart } from "@phosphor-icons/react";
import { loadAttendanceSummary, type WorkspaceData } from "./lib/data";
import { supabase } from "./lib/supabase";
import "./ppt-report.css";

type AnalysisResult = {
  summary?: string;
  strengths?: string[];
  attention?: string[];
  students_needing_support?: Array<{ name?: string; reason?: string; next_action?: string }>;
  class_recommendations?: string[];
  next_month_focus?: string[];
};

type TemplateRow = { id: string; class_id: string | null; name: string; file_path: string; is_active: boolean };

const BRAND = "681474";
const BLUE = "075797";
const TEXT = "202331";
const MUTED = "6F7482";
const LINE = "D9DCE5";
const SOFT = "F4F5F8";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function monthLabel(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, number - 1, 1));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function addBrandHeader(slide: any, title: string, subtitle?: string) {
  slide.addText("ONE PRO", { x: 0.55, y: 0.34, w: 1.3, h: 0.3, fontFace: "Aptos Display", fontSize: 15, bold: true, color: BRAND, margin: 0 });
  slide.addText("JURNAL DIGITAL", { x: 1.82, y: 0.38, w: 1.5, h: 0.22, fontFace: "Aptos", fontSize: 8, bold: true, color: BLUE, margin: 0 });
  slide.addShape("line", { x: 0.55, y: 0.75, w: 12.2, h: 0, line: { color: LINE, width: 1 } });
  slide.addText(title, { x: 0.55, y: 0.92, w: 8.9, h: 0.52, fontFace: "Aptos Display", fontSize: 24, bold: true, color: TEXT, margin: 0 });
  if (subtitle) slide.addText(subtitle, { x: 0.57, y: 1.46, w: 9.5, h: 0.28, fontFace: "Aptos", fontSize: 10, color: MUTED, margin: 0 });
}

async function fillUploadedTemplate(blob: Blob, values: Record<string, string>) {
  const zip = await JSZip.loadAsync(blob);
  const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  let replacements = 0;
  for (const name of slideFiles) {
    const source = await zip.file(name)!.async("string");
    const parser = new DOMParser();
    const xml = parser.parseFromString(source, "application/xml");
    const paragraphs = Array.from(xml.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "p"));
    for (const paragraph of paragraphs) {
      const nodes = Array.from(paragraph.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "t"));
      if (!nodes.length) continue;
      const original = nodes.map((node) => node.textContent ?? "").join("");
      let next = original;
      for (const [token, value] of Object.entries(values)) {
        const count = next.split(token).length - 1;
        if (count) {
          replacements += count;
          next = next.split(token).join(value);
        }
      }
      if (next !== original) {
        nodes[0].textContent = next;
        for (let index = 1; index < nodes.length; index += 1) nodes[index].textContent = "";
      }
    }
    zip.file(name, new XMLSerializer().serializeToString(xml));
  }
  if (!replacements) return null;
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

export function ProfessionalPptReport({ notify, workspace, month, classId, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; month: string; classId: string; previewMode: boolean }) {
  const [generating, setGenerating] = useState(false);
  const selectedClass = workspace.classes.find((item) => item.id === classId && item.is_active);

  const generateStandard = async (data: {
    period: string; className: string; groupName: string; students: Array<{ name: string; hadir: number; izin: number; alpha: number; percent: number }>;
    attendanceRate: number; meetings: number; journals: number; analysis: AnalysisResult;
  }) => {
    const deck = new PptxGenJS();
    deck.layout = "LAYOUT_WIDE";
    deck.author = "ONE PRO Jurnal Digital";
    deck.company = "ONE PRO";
    deck.subject = `Laporan bulanan ${data.className} - ${data.period}`;
    deck.title = `Laporan Bulanan ${data.className}`;
    deck.lang = "id-ID";
    deck.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "id-ID" };

    let slide = deck.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape(deck.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" } });
    slide.addShape(deck.ShapeType.rect, { x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: BRAND }, line: { color: BRAND } });
    slide.addText("ONE PRO", { x: 0.72, y: 0.65, w: 2.1, h: 0.45, fontFace: "Aptos Display", fontSize: 22, bold: true, color: BRAND, margin: 0 });
    slide.addText("LAPORAN BULANAN KELAS", { x: 0.74, y: 2.08, w: 5.4, h: 0.34, fontSize: 13, bold: true, color: BLUE, charSpacing: 1.5, margin: 0 });
    slide.addText(data.className, { x: 0.72, y: 2.52, w: 9.7, h: 0.75, fontFace: "Aptos Display", fontSize: 34, bold: true, color: TEXT, margin: 0 });
    slide.addText(`${data.groupName}  •  ${data.period}`, { x: 0.75, y: 3.45, w: 8.2, h: 0.34, fontSize: 14, color: MUTED, margin: 0 });
    slide.addText("Rekap presensi, jurnal, perkembangan, dan tindak lanjut pembelajaran", { x: 0.75, y: 5.78, w: 8.2, h: 0.5, fontSize: 12, color: MUTED, margin: 0 });

    slide = deck.addSlide();
    addBrandHeader(slide, "Ringkasan Bulanan", `${data.className} • ${data.period}`);
    const cards = [
      ["Siswa aktif", String(data.students.length), BRAND], ["Pertemuan", String(data.meetings), BLUE], ["Jurnal terisi", String(data.journals), BRAND], ["Rata-rata hadir", `${data.attendanceRate}%`, BLUE],
    ];
    cards.forEach(([label, value, color], index) => {
      const x = 0.58 + index * 3.08;
      slide.addShape(deck.ShapeType.roundRect, { x, y: 2.03, w: 2.82, h: 1.22, rectRadius: 0.08, fill: { color: SOFT }, line: { color: LINE, width: 1 } });
      slide.addText(String(value), { x: x + 0.18, y: 2.25, w: 2.4, h: 0.45, fontSize: 24, bold: true, color: String(color), margin: 0 });
      slide.addText(String(label), { x: x + 0.18, y: 2.78, w: 2.4, h: 0.23, fontSize: 9, color: MUTED, margin: 0 });
    });
    slide.addText("Ringkasan", { x: 0.6, y: 3.72, w: 2.1, h: 0.3, fontSize: 14, bold: true, color: BRAND, margin: 0 });
    slide.addText(data.analysis.summary || "Data bulan ini belum cukup untuk menghasilkan ringkasan yang lengkap.", { x: 0.6, y: 4.15, w: 12.05, h: 1.62, fontSize: 16, color: TEXT, breakLine: false, valign: "top", margin: 0.08 });

    const chunks: typeof data.students[] = [];
    for (let index = 0; index < data.students.length; index += 12) chunks.push(data.students.slice(index, index + 12));
    (chunks.length ? chunks : [[]]).forEach((chunk, page) => {
      const s = deck.addSlide();
      addBrandHeader(s, `Rekap Kehadiran${chunks.length > 1 ? ` ${page + 1}` : ""}`, `${data.className} • ${data.period}`);
      const rows = [["Nama siswa", "Hadir", "Izin", "Alpha", "Kehadiran"], ...chunk.map((item) => [item.name, String(item.hadir), String(item.izin), String(item.alpha), `${item.percent}%`])];
      s.addTable(rows, { x: 0.58, y: 1.92, w: 12.15, h: 4.9, border: { type: "solid", color: LINE, pt: 0.7 }, fill: "FFFFFF", color: TEXT, fontFace: "Aptos", fontSize: 10, margin: 0.08, rowH: 0.34, colW: [6.4, 1.35, 1.35, 1.35, 1.7], bold: false, autoFit: false, valign: "mid", breakLine: false });
      s.addShape(deck.ShapeType.rect, { x: 0.58, y: 1.92, w: 12.15, h: 0.42, fill: { color: BRAND }, line: { color: BRAND } });
      ["Nama siswa", "Hadir", "Izin", "Alpha", "Kehadiran"].forEach((header, idx) => {
        const xs = [0.72, 7.05, 8.38, 9.73, 11.07];
        const ws = [5.9, 1.1, 1.1, 1.1, 1.35];
        s.addText(header, { x: xs[idx], y: 2.02, w: ws[idx], h: 0.2, fontSize: 9, bold: true, color: "FFFFFF", align: idx ? "center" : "left", margin: 0 });
      });
    });

    slide = deck.addSlide();
    addBrandHeader(slide, "Evaluasi Pembelajaran", `${data.className} • ${data.period}`);
    const strengths = data.analysis.strengths?.length ? data.analysis.strengths : ["Belum ada kekuatan khusus yang dapat disimpulkan dari data bulan ini."];
    const attention = data.analysis.attention?.length ? data.analysis.attention : ["Belum ada catatan perhatian khusus dari data bulan ini."];
    slide.addShape(deck.ShapeType.roundRect, { x: 0.58, y: 1.95, w: 5.95, h: 4.75, fill: { color: "F7F5FA" }, line: { color: "E5DCE9" } });
    slide.addText("Kekuatan", { x: 0.85, y: 2.2, w: 2.2, h: 0.3, fontSize: 15, bold: true, color: BRAND, margin: 0 });
    slide.addText(strengths.map((item) => ({ text: item, options: { bullet: { indent: 14 }, breakLine: true } })), { x: 0.85, y: 2.7, w: 5.3, h: 3.55, fontSize: 13, color: TEXT, breakLine: false, valign: "top", margin: 0.04 });
    slide.addShape(deck.ShapeType.roundRect, { x: 6.78, y: 1.95, w: 5.95, h: 4.75, fill: { color: "F4F7FA" }, line: { color: "DCE5EC" } });
    slide.addText("Perlu Perhatian", { x: 7.05, y: 2.2, w: 2.8, h: 0.3, fontSize: 15, bold: true, color: BLUE, margin: 0 });
    slide.addText(attention.map((item) => ({ text: item, options: { bullet: { indent: 14 }, breakLine: true } })), { x: 7.05, y: 2.7, w: 5.3, h: 3.55, fontSize: 13, color: TEXT, breakLine: false, valign: "top", margin: 0.04 });

    slide = deck.addSlide();
    addBrandHeader(slide, "Tindak Lanjut Bulan Berikutnya", `${data.className} • ${data.period}`);
    const recommendations = data.analysis.class_recommendations?.length ? data.analysis.class_recommendations : ["Pertahankan konsistensi presensi dan jurnal setiap pertemuan."];
    const nextFocus = data.analysis.next_month_focus?.length ? data.analysis.next_month_focus : ["Konsistensi jurnal, presensi, dan tindak lanjut perkembangan individu."];
    slide.addText("Rekomendasi", { x: 0.62, y: 2.0, w: 2.5, h: 0.3, fontSize: 15, bold: true, color: BRAND, margin: 0 });
    slide.addText(recommendations.map((item) => ({ text: item, options: { bullet: { indent: 16 }, breakLine: true } })), { x: 0.62, y: 2.5, w: 12, h: 1.75, fontSize: 15, color: TEXT, margin: 0.04, valign: "top" });
    slide.addText("Fokus bulan berikutnya", { x: 0.62, y: 4.58, w: 3.2, h: 0.3, fontSize: 15, bold: true, color: BLUE, margin: 0 });
    slide.addText(nextFocus.map((item) => ({ text: item, options: { bullet: { indent: 16 }, breakLine: true } })), { x: 0.62, y: 5.08, w: 12, h: 1.5, fontSize: 15, color: TEXT, margin: 0.04, valign: "top" });

    await deck.writeFile({ fileName: `Laporan-Bulanan-${safeName(data.className)}-${month}.pptx` });
  };

  const generate = async () => {
    if (!selectedClass) { notify("Pilih kelas terlebih dahulu"); return; }
    if (!month) { notify("Pilih bulan laporan terlebih dahulu"); return; }
    if (previewMode) { notify("Mode pratinjau: PPT tersedia pada data produksi"); return; }
    const client = supabase;
    if (!client) { notify("Koneksi database belum tersedia"); return; }
    setGenerating(true);
    try {
      const [analysisResponse, attendance, journalsResult, templateResult] = await Promise.all([
        client.functions.invoke("analyze-monthly-journal", { body: { classId, month } }),
        loadAttendanceSummary(),
        client.from("daily_journals").select("id,journal_date").eq("class_id", classId).gte("journal_date", `${month}-01`).lte("journal_date", `${month}-31`),
        client.from("report_templates").select("id,class_id,name,file_path,is_active").eq("class_id", classId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (analysisResponse.error) throw analysisResponse.error;
      if (journalsResult.error) throw journalsResult.error;
      if (templateResult.error) throw templateResult.error;
      const analysis = (analysisResponse.data?.analysis ?? {}) as AnalysisResult;
      const enrolledIds = new Set(workspace.enrollments.filter((item) => item.class_id === classId && !item.ended_on).map((item) => item.student_id));
      const students = workspace.students.filter((student) => student.status !== "archived" && enrolledIds.has(student.id));
      const rows = attendance.filter((row) => row.class_id === classId && row.session_date.startsWith(month));
      const perStudent = students.map((student) => {
        const studentRows = rows.filter((row) => row.student_id === student.id);
        const hadir = studentRows.filter((row) => row.status === "hadir").length;
        const izin = studentRows.filter((row) => row.status === "izin").length;
        const alpha = studentRows.filter((row) => row.status === "alpha").length;
        return { name: student.full_name, hadir, izin, alpha, percent: studentRows.length ? Math.round(hadir / studentRows.length * 100) : 0 };
      });
      const totalPresent = rows.filter((row) => row.status === "hadir").length;
      const rate = rows.length ? Math.round(totalPresent / rows.length * 100) : 0;
      const meetings = new Set(rows.map((row) => row.session_date)).size;
      const group = workspace.groups.find((item) => item.id === selectedClass.group_id);
      const period = monthLabel(month);
      const values: Record<string, string> = {
        "{{NAMA_KELAS}}": selectedClass.name,
        "{{BULAN}}": period,
        "{{PERIODE}}": period,
        "{{TOTAL_SISWA}}": String(students.length),
        "{{PERTEMUAN}}": String(meetings),
        "{{JURNAL_TERISI}}": String(journalsResult.data?.length ?? 0),
        "{{RATA_KEHADIRAN}}": `${rate}%`,
        "{{RINGKASAN}}": analysis.summary || "Data bulan ini belum cukup untuk ringkasan lengkap.",
        "{{KEKUATAN}}": (analysis.strengths ?? []).join("\n• ") || "Belum ada catatan kekuatan khusus.",
        "{{PERLU_PERHATIAN}}": (analysis.attention ?? []).join("\n• ") || "Belum ada catatan perhatian khusus.",
        "{{REKOMENDASI}}": (analysis.class_recommendations ?? []).join("\n• ") || "Pertahankan konsistensi presensi dan jurnal.",
        "{{FOKUS_BULAN_DEPAN}}": (analysis.next_month_focus ?? []).join("\n• ") || "Konsistensi jurnal dan tindak lanjut perkembangan individu.",
      };
      const activeTemplate = templateResult.data as TemplateRow | null;
      if (activeTemplate?.file_path) {
        const downloaded = await client.storage.from("report-templates").download(activeTemplate.file_path);
        if (downloaded.error) throw downloaded.error;
        const filled = await fillUploadedTemplate(downloaded.data, values);
        if (filled) {
          downloadBlob(filled, `Laporan-Bulanan-${safeName(selectedClass.name)}-${month}.pptx`);
          notify(`PPT ${period} berhasil dibuat dari template kelas`);
          return;
        }
        notify("Template custom belum memiliki placeholder yang terbaca. Sistem memakai template standar ONE PRO.");
      }
      await generateStandard({ period, className: selectedClass.name, groupName: group?.name ?? "Kelompok", students: perStudent, attendanceRate: rate, meetings, journals: journalsResult.data?.length ?? 0, analysis });
      notify(`PPT ${period} berhasil dibuat`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "PPT gagal dibuat");
    } finally {
      setGenerating(false);
    }
  };

  return <section className="ppt-report-manager">
    <header><span className="ppt-report-icon"><PresentationChart size={24} /></span><div><h2>Laporan PowerPoint</h2><p>File PPT mengambil data hanya dari bulan dan kelas yang dipilih. Template custom digunakan bila valid; bila tidak, ONE PRO memakai template profesional bawaan.</p></div></header>
    <div className="ppt-report-meta"><div><span>Kelas</span><strong>{selectedClass?.name ?? "Belum dipilih"}</strong></div><div><span>Periode</span><strong>{month ? monthLabel(month) : "Belum dipilih"}</strong></div></div>
    <button className="ppt-generate-button" disabled={generating || !selectedClass || !month} onClick={() => void generate()}><DownloadSimple size={18} />{generating ? "Menyusun PPT…" : "Cetak PPT"}</button>
  </section>;
}
'''
Path('src/ppt-report.tsx').write_text(ppt)

css = r'''.ppt-report-manager{display:grid;gap:14px;padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--surface)}
.ppt-report-manager>header{display:flex;gap:12px;align-items:flex-start}.ppt-report-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:12px;color:#fff;background:linear-gradient(135deg,var(--purple-2),var(--blue))}.ppt-report-manager h2{margin:0 0 4px;font-size:17px}.ppt-report-manager p{margin:0;color:var(--muted);font-size:9px;line-height:1.55}.ppt-report-meta{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ppt-report-meta>div{display:grid;gap:4px;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}.ppt-report-meta span{font-size:8px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.55px}.ppt-report-meta strong{font-size:11px}.ppt-generate-button{min-height:46px;display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:12px;color:#fff;background:linear-gradient(135deg,var(--purple-2),var(--blue));font-size:10px;font-weight:900}.ppt-generate-button:disabled{opacity:.55}.report-period-panel{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(240px,1fr) minmax(260px,1.4fr);gap:10px;align-items:end;margin-bottom:16px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}.report-period-panel label{display:grid;gap:6px}.report-period-panel label>span,.report-period-note span{font-size:9px;font-weight:800;color:var(--muted)}.report-period-panel select,.report-period-panel input{min-height:43px!important}.report-period-note{min-height:43px;display:flex;align-items:center;padding:0 12px;border:1px solid color-mix(in srgb,var(--purple-2) 18%,var(--line));border-radius:11px;background:color-mix(in srgb,var(--purple-2) 5%,var(--surface));color:var(--text)}.report-period-note strong{font-size:9px;line-height:1.45}@media(max-width:760px){.ppt-report-meta,.report-period-panel{grid-template-columns:1fr}.ppt-report-manager{padding:14px}.report-period-note{padding:10px 12px}}
'''
Path('src/ppt-report.css').write_text(css)

proto = Path('src/Prototype.tsx')
s = proto.read_text()
anchor = 'import { ProfessionalWordReport } from "./word-report";\n'
if 'from "./ppt-report"' not in s:
    s = s.replace(anchor, anchor + 'import { ProfessionalPptReport } from "./ppt-report";\n', 1)

# Add class-report guard and make the reporting period explicit before output actions.
old_header = '    <PageHeader title="Laporan" subtitle="Rekap presensi dan ketercapaian target bulanan" action={<label className="month-input"><span>Bulan</span><KeyboardInput type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>} />\n'
new_header = '    <PageHeader title="Laporan" subtitle="Pilih bulan dan kelas sebelum membuat laporan" />\n    <div className="report-period-panel"><label><span>Bulan laporan</span><KeyboardInput type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label><span>Kelas</span><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>{tab === "individual" ? <option value="all">Semua kelas</option> : null}{workspace.classes.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="report-period-note"><strong>Semua rekap dan file yang dibuat hanya menggunakan data pada bulan yang dipilih.</strong></div></div>\n'
if old_header in s:
    s = s.replace(old_header, new_header, 1)
elif 'className="report-period-panel"' not in s:
    raise SystemExit('report header anchor missing')

old_filter = '    <div className="report-filter"><label className="field"><span>Filter kelas</span><select value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="all">Semua kelas</option>{workspace.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>\n'
s = s.replace(old_filter, '', 1)

# When entering class report, always choose a concrete class.
needle = '  const studentStats = students.filter(s => !selectedIds || selectedIds.has(s.id)).map((student) => {'
if 'if (tab === "class" && classFilter === "all")' not in s:
    insert = '  useEffect(() => { if (tab === "class" && classFilter === "all") setClassFilter(workspace.classes.find((item) => item.is_active)?.id ?? "all"); }, [tab, classFilter, workspace.classes]);\n'
    s = s.replace(needle, insert + needle, 1)

old_class = ': <><ProfessionalWordReport notify={notify} workspace={workspace} month={month} previewMode={previewMode} /><PptTemplateManager notify={notify} workspace={workspace} previewMode={previewMode} /></>}'
new_class = ': <><ProfessionalWordReport notify={notify} workspace={workspace} month={month} classId={classFilter === "all" ? "" : classFilter} previewMode={previewMode} /><ProfessionalPptReport notify={notify} workspace={workspace} month={month} classId={classFilter === "all" ? "" : classFilter} previewMode={previewMode} /><PptTemplateManager notify={notify} workspace={workspace} classId={classFilter === "all" ? "" : classFilter} previewMode={previewMode} /></>}'
if old_class in s:
    s = s.replace(old_class, new_class, 1)
elif '<ProfessionalPptReport notify={notify}' not in s:
    raise SystemExit('class report branch anchor missing')
proto.write_text(s)

word = Path('src/word-report.tsx')
w = word.read_text()
w = w.replace('import { useMemo, useState } from "react";', 'import { useState } from "react";', 1)
w = w.replace('export function ProfessionalWordReport({ notify, workspace, month, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; month: string; previewMode: boolean }) {\n  const classes = useMemo(() => workspace.classes.filter((item) => item.is_active), [workspace.classes]);\n  const [classId, setClassId] = useState(classes[0]?.id ?? "");\n  const [generating, setGenerating] = useState(false);\n  const selectedClass = classes.find((item) => item.id === classId);', 'export function ProfessionalWordReport({ notify, workspace, month, classId, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; month: string; classId: string; previewMode: boolean }) {\n  const [generating, setGenerating] = useState(false);\n  const selectedClass = workspace.classes.find((item) => item.id === classId && item.is_active);', 1)
w = w.replace('      <label><span>Kelas</span><select value={classId} onChange={(event) => setClassId(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>\n      <div className="word-template-badge"><strong>Template ONE PRO Standard</strong><small>A4 • DOCX • siap edit dan cetak</small></div>', '      <div className="word-template-badge"><strong>{selectedClass?.name ?? "Kelas belum dipilih"}</strong><small>Kelas laporan aktif</small></div>\n      <div className="word-template-badge"><strong>Template ONE PRO Standard</strong><small>A4 • DOCX • siap edit dan cetak</small></div>', 1)
w = w.replace('disabled={generating || !classId}', 'disabled={generating || !selectedClass || !month}', 1)
word.write_text(w)

ops = Path('src/operations-workspace.tsx')
o = ops.read_text()
o = o.replace('export function PptTemplateManager({ notify, workspace, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; previewMode: boolean }) {\n  const inputRef=useRef<HTMLInputElement|null>(null);\n  const [classId,setClassId]=useState(workspace.classes[0]?.id??"");', 'export function PptTemplateManager({ notify, workspace, classId, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; classId: string; previewMode: boolean }) {\n  const inputRef=useRef<HTMLInputElement|null>(null);', 1)
o = o.replace('  useEffect(()=>{if(!classId&&workspace.classes[0])setClassId(workspace.classes[0].id);},[classId,workspace.classes]);\n', '', 1)
o = o.replace('<label><span>Kelas</span><select value={classId} onChange={event=>setClassId(event.target.value)}>{workspace.classes.filter(item=>item.is_active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="template-status">', '<div className="template-status"><strong>{workspace.classes.find(item=>item.id===classId)?.name||"Kelas belum dipilih"}</strong><small>Kelas template aktif</small></div><div className="template-status">', 1)
# Expand documented placeholders for actual generation.
o = o.replace('["{{NAMA_KELAS}}","{{BULAN}}","{{TOTAL_SISWA}}","{{RATA_KEHADIRAN}}","{{RINGKASAN}}","{{KEKUATAN}}","{{PERLU_PERHATIAN}}","{{REKOMENDASI}}"]', '["{{NAMA_KELAS}}","{{BULAN}}","{{TOTAL_SISWA}}","{{PERTEMUAN}}","{{JURNAL_TERISI}}","{{RATA_KEHADIRAN}}","{{RINGKASAN}}","{{KEKUATAN}}","{{PERLU_PERHATIAN}}","{{REKOMENDASI}}","{{FOKUS_BULAN_DEPAN}}"]', 1)
ops.write_text(o)

agents = Path('AGENTS.md')
a = agents.read_text()
line = '- Reports are month-first: the user selects month and class before generating output. CSV, print, Word, and PPT must use only that selected month. PPT generation uses a valid uploaded placeholder template when available, otherwise the built-in professional ONE PRO deck.\n'
if line not in a:
    heading = '## Class database, attendance recap, and report-template decisions — 2026-09-17\n'
    idx = a.index(heading) + len(heading) if heading in a else len(a)
    a = a[:idx] + '\n' + line + a[idx:]
    agents.write_text(a)
