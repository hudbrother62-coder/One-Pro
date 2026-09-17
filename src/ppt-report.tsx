import { useState } from "react";
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
    deck.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos" };

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
      s.addTable(rows as any, { x: 0.58, y: 1.92, w: 12.15, h: 4.9, border: { type: "solid", color: LINE, pt: 0.7 }, fill: { color: "FFFFFF" }, color: TEXT, fontFace: "Aptos", fontSize: 10, margin: 0.08, rowH: 0.34, colW: [6.4, 1.35, 1.35, 1.35, 1.7], bold: false, autoFit: false, valign: "middle", breakLine: false } as any);
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
