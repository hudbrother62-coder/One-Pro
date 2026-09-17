import { useState } from "react";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { FileDoc, DownloadSimple } from "@phosphor-icons/react";
import { loadAttendanceSummary, type WorkspaceData } from "./lib/data";
import { supabase } from "./lib/supabase";
import "./word-report.css";

type AnalysisResult = {
  summary?: string;
  strengths?: string[];
  attention?: string[];
  students_needing_support?: Array<{ student_id?: string; name?: string; reason?: string; next_action?: string }>;
  class_recommendations?: string[];
  next_month_focus?: string[];
  data_quality?: { status?: string; notes?: string[] };
};

const BRAND = "681474";
const BLUE = "075797";
const TEXT = "202331";
const MUTED = "6F7482";
const LINE = "D9DCE5";
const SOFT = "F5F6F9";
const WARNING = "FFF4DF";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function monthLabel(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, number - 1, 1));
}

function labelRun(text: string) {
  return new TextRun({ text, bold: true, color: MUTED, size: 18, font: "Aptos" });
}

function valueRun(text: string, color = TEXT) {
  return new TextRun({ text, bold: true, color, size: 23, font: "Aptos" });
}

function cell(text: string, options: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; fill?: string; color?: string } = {}) {
  return new TableCell({
    shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: options.align ?? AlignmentType.LEFT,
      children: [new TextRun({ text, bold: options.bold, color: options.color ?? TEXT, size: 18, font: "Aptos" })],
    })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 70 },
    children: [new TextRun({ text, size: 20, color: TEXT, font: "Aptos" })],
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 230, after: 110 },
    children: [new TextRun({ text, bold: true, size: 27, color: BRAND, font: "Aptos Display" })],
  });
}

function statCell(label: string, value: string, accent = BRAND) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: SOFT, color: "auto" },
    margins: { top: 150, bottom: 150, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [valueRun(value, accent)] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [labelRun(label)] }),
    ],
  });
}

export function ProfessionalWordReport({ notify, workspace, month, classId, previewMode }: { notify: (message: string) => void; workspace: WorkspaceData; month: string; classId: string; previewMode: boolean }) {
  const [generating, setGenerating] = useState(false);
  const selectedClass = workspace.classes.find((item) => item.id === classId && item.is_active);

  const generate = async () => {
    if (!selectedClass) { notify("Pilih kelas terlebih dahulu"); return; }
    if (previewMode) { notify("Mode pratinjau: laporan Word tersedia pada data produksi"); return; }
    const client = supabase;
    if (!client) { notify("Koneksi database belum tersedia"); return; }
    setGenerating(true);
    try {
      const analysisResponse = await client.functions.invoke("analyze-monthly-journal", { body: { classId, month } });
      if (analysisResponse.error) throw analysisResponse.error;
      const analysis = (analysisResponse.data?.analysis ?? {}) as AnalysisResult;
      const [attendance, journalsResult] = await Promise.all([
        loadAttendanceSummary(),
        client.from("daily_journals").select("id,journal_date").eq("class_id", classId).gte("journal_date", `${month}-01`).lte("journal_date", `${month}-31`),
      ]);
      if (journalsResult.error) throw journalsResult.error;

      const enrolledIds = new Set(workspace.enrollments.filter((item) => item.class_id === classId && !item.ended_on).map((item) => item.student_id));
      const students = workspace.students.filter((student) => student.status !== "archived" && enrolledIds.has(student.id));
      const monthRows = attendance.filter((row) => row.class_id === classId && row.session_date.startsWith(month));
      const sessionDates = new Set(monthRows.map((row) => row.session_date));
      const perStudent = students.map((student) => {
        const rows = monthRows.filter((row) => row.student_id === student.id);
        const hadir = rows.filter((row) => row.status === "hadir").length;
        const izin = rows.filter((row) => row.status === "izin").length;
        const alpha = rows.filter((row) => row.status === "alpha").length;
        return { student, hadir, izin, alpha, total: rows.length, percent: rows.length ? Math.round((hadir / rows.length) * 100) : 0 };
      });
      const totalRecords = monthRows.length;
      const totalPresent = monthRows.filter((row) => row.status === "hadir").length;
      const attendanceRate = totalRecords ? Math.round((totalPresent / totalRecords) * 100) : 0;
      const group = workspace.groups.find((item) => item.id === selectedClass.group_id);
      const period = monthLabel(month);
      const journalsCount = journalsResult.data?.length ?? 0;
      const strengths = analysis.strengths?.length ? analysis.strengths : ["Belum ada kekuatan khusus yang dapat disimpulkan dari data bulan ini."];
      const attention = analysis.attention?.length ? analysis.attention : ["Belum ada catatan perhatian khusus dari data bulan ini."];
      const recommendations = analysis.class_recommendations?.length ? analysis.class_recommendations : ["Pertahankan konsistensi presensi dan jurnal setiap pertemuan."];
      const nextFocus = analysis.next_month_focus?.length ? analysis.next_month_focus : ["Konsistensi jurnal, presensi, dan tindak lanjut perkembangan individu."];

      const border = { style: BorderStyle.SINGLE, size: 1, color: LINE };
      const header = new Header({ children: [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, margins: { bottom: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "ONE PRO", bold: true, color: BRAND, size: 22, font: "Aptos Display" }), new TextRun({ text: "  JURNAL DIGITAL", bold: true, color: BLUE, size: 16, font: "Aptos" })] })] }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, margins: { bottom: 80 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "LAPORAN BULANAN", bold: true, color: MUTED, size: 16, font: "Aptos" })] })] }),
        ] })],
      })] });
      const footer = new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "ONE PRO Jurnal Digital  •  Dokumen laporan kelas  •  Halaman ", color: MUTED, size: 15, font: "Aptos" }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 15, font: "Aptos" })],
      })] });

      const introTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows: [
          new TableRow({ children: [cell("Kelas", { fill: SOFT, bold: true }), cell(selectedClass.name), cell("Periode", { fill: SOFT, bold: true }), cell(period)] }),
          new TableRow({ children: [cell("Kelompok", { fill: SOFT, bold: true }), cell(group?.name ?? "—"), cell("Jumlah siswa", { fill: SOFT, bold: true }), cell(String(students.length))] }),
        ],
      });

      const summaryBox = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "D7D9E4" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7D9E4" }, left: { style: BorderStyle.SINGLE, size: 1, color: "D7D9E4" }, right: { style: BorderStyle.SINGLE, size: 1, color: "D7D9E4" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        rows: [new TableRow({ children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: SOFT, color: "auto" },
          margins: { top: 180, bottom: 180, left: 180, right: 180 },
          children: [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "RINGKASAN EKSEKUTIF", bold: true, color: BRAND, size: 18, font: "Aptos" })] }), new Paragraph({ children: [new TextRun({ text: analysis.summary || "Data bulan ini belum cukup untuk menghasilkan ringkasan perkembangan yang lengkap.", color: TEXT, size: 20, font: "Aptos" })] })],
        })] })],
      });

      const statTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.SINGLE, size: 8, color: "FFFFFF" } },
        rows: [new TableRow({ children: [statCell("Siswa aktif", String(students.length)), statCell("Pertemuan tercatat", String(sessionDates.size), BLUE), statCell("Jurnal terisi", String(journalsCount)), statCell("Rata-rata hadir", `${attendanceRate}%`, attendanceRate >= 85 ? "168768" : BLUE)] })],
      });

      const studentRows = perStudent.map((item, index) => new TableRow({
        children: [
          cell(String(index + 1), { align: AlignmentType.CENTER }),
          cell(item.student.full_name),
          cell(String(item.hadir), { align: AlignmentType.CENTER }),
          cell(String(item.izin), { align: AlignmentType.CENTER }),
          cell(String(item.alpha), { align: AlignmentType.CENTER }),
          cell(`${item.percent}%`, { align: AlignmentType.CENTER, bold: true, color: item.percent >= 85 ? "168768" : item.percent < 70 ? "C23C47" : BLUE }),
        ],
      }));
      const studentTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows: [new TableRow({ tableHeader: true, children: [cell("No", { fill: BRAND, bold: true, color: "FFFFFF", align: AlignmentType.CENTER }), cell("Nama siswa", { fill: BRAND, bold: true, color: "FFFFFF" }), cell("Hadir", { fill: BRAND, bold: true, color: "FFFFFF", align: AlignmentType.CENTER }), cell("Izin", { fill: BRAND, bold: true, color: "FFFFFF", align: AlignmentType.CENTER }), cell("Alpha", { fill: BRAND, bold: true, color: "FFFFFF", align: AlignmentType.CENTER }), cell("Kehadiran", { fill: BRAND, bold: true, color: "FFFFFF", align: AlignmentType.CENTER })] }), ...studentRows],
      });

      const supportRows = (analysis.students_needing_support ?? []).map((item, index) => new TableRow({ children: [
        cell(String(index + 1), { align: AlignmentType.CENTER }),
        cell(item.name || "Siswa"),
        cell(item.reason || "Perlu pemantauan lanjutan"),
        cell(item.next_action || "Tindak lanjuti pada pertemuan berikutnya"),
      ] }));
      const supportTable = supportRows.length ? new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows: [new TableRow({ tableHeader: true, children: [cell("No", { fill: WARNING, bold: true, align: AlignmentType.CENTER }), cell("Siswa", { fill: WARNING, bold: true }), cell("Catatan", { fill: WARNING, bold: true }), cell("Tindak lanjut", { fill: WARNING, bold: true })] }), ...supportRows],
      }) : null;

      const signTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mengetahui,", size: 18, font: "Aptos" })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PJ Kelompok", bold: true, size: 18, font: "Aptos" })] }), new Paragraph({ spacing: { before: 650 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "( __________________________ )", size: 18, font: "Aptos" })] })] }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Guru Kelas", size: 18, font: "Aptos" })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: selectedClass.name, bold: true, size: 18, font: "Aptos" })] }), new Paragraph({ spacing: { before: 650 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "( __________________________ )", size: 18, font: "Aptos" })] })] }),
        ] })],
      });

      const children = [
        new Paragraph({ spacing: { before: 500, after: 80 }, children: [new TextRun({ text: "LAPORAN BULANAN PENGAJIAN", bold: true, size: 34, color: TEXT, font: "Aptos Display" })] }),
        new Paragraph({ spacing: { after: 260 }, children: [new TextRun({ text: `${selectedClass.name}  •  ${period}`, size: 22, color: MUTED, font: "Aptos" })] }),
        introTable,
        new Paragraph({ spacing: { after: 150 } }),
        summaryBox,
        sectionHeading("Ikhtisar Bulanan"),
        statTable,
        sectionHeading("Rekap Kehadiran per Siswa"),
        ...(perStudent.length ? [studentTable] : [new Paragraph({ children: [new TextRun({ text: "Belum ada data presensi siswa pada periode ini.", color: MUTED, size: 20, font: "Aptos" })] })]),
        new Paragraph({ children: [new PageBreak()] }),
        sectionHeading("Evaluasi Pembelajaran"),
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Kekuatan", bold: true, color: TEXT, size: 21, font: "Aptos" })] }),
        ...strengths.map(bullet),
        new Paragraph({ spacing: { before: 130, after: 80 }, children: [new TextRun({ text: "Perlu perhatian", bold: true, color: TEXT, size: 21, font: "Aptos" })] }),
        ...attention.map(bullet),
        sectionHeading("Siswa yang Memerlukan Pendampingan"),
        ...(supportTable ? [supportTable] : [new Paragraph({ children: [new TextRun({ text: "Belum ada siswa yang ditandai memerlukan pendampingan khusus dari data bulan ini.", color: MUTED, size: 20, font: "Aptos" })] })]),
        sectionHeading("Rekomendasi Tindak Lanjut"),
        ...recommendations.map(bullet),
        new Paragraph({ spacing: { before: 130, after: 80 }, children: [new TextRun({ text: "Fokus bulan berikutnya", bold: true, color: TEXT, size: 21, font: "Aptos" })] }),
        ...nextFocus.map(bullet),
        sectionHeading("Pengesahan"),
        signTable,
      ];

      const doc = new Document({
        creator: "ONE PRO Jurnal Digital",
        title: `Laporan Bulanan ${selectedClass.name} ${period}`,
        description: "Laporan bulanan pengajian ONE PRO Jurnal Digital",
        styles: {
          default: { document: { run: { font: "Aptos", size: 20, color: TEXT }, paragraph: { spacing: { line: 276 } } } },
          paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 34, bold: true, color: TEXT, font: "Aptos Display" }, paragraph: { spacing: { before: 240, after: 120 } } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 27, bold: true, color: BRAND, font: "Aptos Display" }, paragraph: { spacing: { before: 230, after: 110 } } },
          ],
        },
        sections: [{
          properties: { page: { margin: { top: 900, right: 850, bottom: 900, left: 850 } } },
          headers: { default: header },
          footers: { default: footer },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan-Bulanan-${safeName(selectedClass.name)}-${month}.docx`;
      link.click();
      URL.revokeObjectURL(url);
      notify("Laporan Word profesional berhasil dibuat");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Laporan Word gagal dibuat");
    } finally {
      setGenerating(false);
    }
  };

  return <section className="word-report-manager">
    <header>
      <span className="word-report-icon"><FileDoc size={24} /></span>
      <div><h2>Laporan Word Profesional</h2><p>Template resmi ONE PRO sudah disiapkan sistem. Isi laporan diambil dari presensi, jurnal, perkembangan, dan analisis bulanan.</p></div>
    </header>
    <div className="word-report-controls">
      <div className="word-template-badge"><strong>{selectedClass?.name ?? "Kelas belum dipilih"}</strong><small>Kelas laporan aktif</small></div>
      <div className="word-template-badge"><strong>Template ONE PRO Standard</strong><small>A4 • DOCX • siap edit dan cetak</small></div>
    </div>
    <div className="word-report-sections"><span>Ringkasan</span><span>Presensi</span><span>Perkembangan</span><span>Rekomendasi</span><span>Pengesahan</span></div>
    <button className="word-download-button" disabled={generating || !selectedClass || !month} onClick={() => void generate()}><DownloadSimple size={18} />{generating ? "Menyusun laporan…" : "Unduh Laporan Word"}</button>
  </section>;
}
