import JSZip from "jszip";
import type { WorkspaceStudent } from "./lib/data";

export const STUDENT_IMPORT_HEADERS = [
  "Nama Lengkap",
  "Nama Panggilan",
  "Jenjang",
  "Tempat Lahir",
  "Tanggal Lahir",
  "Alamat",
  "Nomor HP Anak",
  "Nama Ayah",
  "WhatsApp Ayah",
  "Nama Ibu",
  "WhatsApp Ibu",
  "Tampilkan Foto",
  "Status",
] as const;

export type StudentImportRow = {
  group_id: string;
  full_name: string;
  nickname: string | null;
  school_grade: number | null;
  birth_place: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  show_photo: boolean;
  status: "active" | "inactive";
};

export type ImportIssue = { row: number; field?: string; message: string };
export type StudentImportPreview = {
  rows: StudentImportRow[];
  issues: ImportIssue[];
  fileName: string;
  totalRows: number;
};

const gradeMap: Record<string, number> = {
  "PAUD": 0,
  "0": 0,
  "SD 1": 1,
  "SD1": 1,
  "KELAS 1": 1,
  "1": 1,
  "SD 2": 2,
  "SD2": 2,
  "KELAS 2": 2,
  "2": 2,
  "SD 3": 3,
  "SD3": 3,
  "KELAS 3": 3,
  "3": 3,
  "SD 4": 4,
  "SD4": 4,
  "KELAS 4": 4,
  "4": 4,
  "SD 5": 5,
  "SD5": 5,
  "KELAS 5": 5,
  "5": 5,
  "SD 6": 6,
  "SD6": 6,
  "KELAS 6": 6,
  "6": 6,
};

function esc(value: string) {
  return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

function colLetter(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function inlineCell(ref: string, value: string, style = 0) {
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function rowXml(row: number, values: string[], style = 0) {
  return `<row r="${row}">${values.map((value,index)=>inlineCell(`${colLetter(index)}${row}`,value,style)).join("")}</row>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="DATA_SISWA" sheetId="1" r:id="rId1"/>
    <sheet name="PETUNJUK" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Aptos"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font>
    <font><b/><color rgb="FF7C3AED"/><sz val="12"/><name val="Aptos"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F0FF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD8DEE9"/></left><right style="thin"><color rgb="FFD8DEE9"/></right><top style="thin"><color rgb="FFD8DEE9"/></top><bottom style="thin"><color rgb="FFD8DEE9"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function dataSheetXml() {
  const widths = [25,18,13,18,17,34,18,22,18,22,18,16,14];
  const cols = widths.map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>
    ${rowXml(1,[...STUDENT_IMPORT_HEADERS],1)}
  </sheetData>
  <autoFilter ref="A1:M500"/>
  <dataValidations count="3">
    <dataValidation type="list" allowBlank="0" showErrorMessage="1" errorTitle="Jenjang tidak valid" error="Gunakan PAUD atau SD 1 sampai SD 6." sqref="C2:C500"><formula1>"PAUD,SD 1,SD 2,SD 3,SD 4,SD 5,SD 6"</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Pilihan tidak valid" error="Gunakan Ya atau Tidak." sqref="L2:L500"><formula1>"Ya,Tidak"</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Status tidak valid" error="Gunakan Aktif atau Nonaktif." sqref="M2:M500"><formula1>"Aktif,Nonaktif"</formula1></dataValidation>
  </dataValidations>
</worksheet>`;
}

function guideSheetXml() {
  const rows = [
    ["TEMPLATE IMPORT SISWA ONE PRO",""],
    ["Cara penggunaan","Isi data hanya di sheet DATA_SISWA. Jangan mengubah nama kolom baris pertama."],
    ["Wajib diisi","Nama Lengkap dan Jenjang."],
    ["Jenjang","Gunakan PAUD, SD 1, SD 2, SD 3, SD 4, SD 5, atau SD 6."],
    ["Tanggal Lahir","Gunakan format YYYY-MM-DD, contoh 2018-05-17."],
    ["Nomor HP/WhatsApp","Simpan sebagai teks agar angka 0 di depan tidak hilang."],
    ["Tampilkan Foto","Isi Ya atau Tidak. Jika kosong, sistem memakai Ya."],
    ["Status","Isi Aktif atau Nonaktif. Jika kosong, sistem memakai Aktif."],
    ["Batas import","Maksimal 500 siswa dalam satu file."],
    ["Validasi","ONE PRO memeriksa struktur file, format data, duplikasi di file, dan duplikasi terhadap database sebelum import."],
    ["Contoh","Budi Santoso | Budi | SD 3 | Malang | 2017-08-12 | ..."],
  ];
  const widths = '<cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="78" customWidth="1"/></cols>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${widths}
  <sheetData>
    ${rows.map((r,index)=>rowXml(index+1,r,index===0?3:2)).join("")}
  </sheetData>
</worksheet>`;
}

export async function downloadStudentImportTemplate() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.folder("xl")?.file("workbook.xml",workbookXml());
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.folder("xl")?.file("styles.xml",stylesXml());
  zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml",dataSheetXml());
  zip.folder("xl")?.folder("worksheets")?.file("sheet2.xml",guideSheetXml());
  const blob = await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href=url;
  link.download="Template-Import-Siswa-One-Pro.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

function parseSharedStrings(xml: string | null) {
  if (!xml) return [] as string[];
  const doc = new DOMParser().parseFromString(xml,"application/xml");
  return [...doc.getElementsByTagName("si")].map(node => [...node.getElementsByTagName("t")].map(t=>t.textContent??"").join(""));
}

function cellValue(cell: Element, shared: string[]) {
  const type=cell.getAttribute("t");
  if(type==="inlineStr") return [...cell.getElementsByTagName("t")].map(t=>t.textContent??"").join("");
  const raw=cell.getElementsByTagName("v")[0]?.textContent ?? "";
  if(type==="s") return shared[Number(raw)] ?? "";
  if(type==="b") return raw==="1" ? "TRUE" : "FALSE";
  return raw;
}

function serialToDate(value: string) {
  const n=Number(value);
  if(!Number.isFinite(n)||n<1) return value;
  const date=new Date(Date.UTC(1899,11,30)+Math.round(n)*86400000);
  return date.toISOString().slice(0,10);
}

function normalizePhone(value: string) {
  const trimmed=value.trim();
  if(!trimmed) return null;
  return trimmed.replace(/\s+/g," ");
}

function normalizeGrade(value: string) {
  const key=value.trim().toUpperCase().replace(/\s+/g," ");
  return Object.prototype.hasOwnProperty.call(gradeMap,key) ? gradeMap[key] : null;
}

function normalizeBoolean(value:string) {
  const key=value.trim().toLowerCase();
  if(!key) return true;
  if(["ya","yes","y","1","true"].includes(key)) return true;
  if(["tidak","no","n","0","false"].includes(key)) return false;
  return null;
}

function normalizeStatus(value:string) {
  const key=value.trim().toLowerCase();
  if(!key||key==="aktif"||key==="active") return "active" as const;
  if(key==="nonaktif"||key==="non aktif"||key==="inactive") return "inactive" as const;
  return null;
}

export async function parseStudentImportFile(file: File, groupId: string, existing: WorkspaceStudent[]): Promise<StudentImportPreview> {
  const issues: ImportIssue[]=[];
  const rows: StudentImportRow[]=[];
  if(!file.name.toLowerCase().endsWith(".xlsx")) return {rows,issues:[{row:0,message:"Gunakan file .xlsx dari template ONE PRO."}],fileName:file.name,totalRows:0};
  if(file.size>2*1024*1024) return {rows,issues:[{row:0,message:"Ukuran file maksimal 2 MB."}],fileName:file.name,totalRows:0};

  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const workbookText=await zip.file("xl/workbook.xml")?.async("text");
  if(!workbookText) return {rows,issues:[{row:0,message:"Struktur workbook tidak dikenali."}],fileName:file.name,totalRows:0};
  const workbookDoc=new DOMParser().parseFromString(workbookText,"application/xml");
  const sheet=[...workbookDoc.getElementsByTagName("sheet")].find(node=>node.getAttribute("name")==="DATA_SISWA");
  const relId=sheet?.getAttribute("r:id") || sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
  if(!sheet||!relId) return {rows,issues:[{row:0,message:"Sheet DATA_SISWA tidak ditemukan. Gunakan template resmi ONE PRO."}],fileName:file.name,totalRows:0};

  const relText=await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if(!relText) return {rows,issues:[{row:0,message:"Relasi workbook tidak valid."}],fileName:file.name,totalRows:0};
  const relDoc=new DOMParser().parseFromString(relText,"application/xml");
  const rel=[...relDoc.getElementsByTagName("Relationship")].find(node=>node.getAttribute("Id")===relId);
  const target=rel?.getAttribute("Target");
  if(!target) return {rows,issues:[{row:0,message:"Sheet DATA_SISWA tidak dapat dibaca."}],fileName:file.name,totalRows:0};
  const sheetPath=target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//,"")}`;
  const sheetText=await zip.file(sheetPath)?.async("text");
  if(!sheetText) return {rows,issues:[{row:0,message:"Isi sheet DATA_SISWA tidak ditemukan."}],fileName:file.name,totalRows:0};

  const sharedText=await zip.file("xl/sharedStrings.xml")?.async("text") ?? null;
  const shared=parseSharedStrings(sharedText);
  const doc=new DOMParser().parseFromString(sheetText,"application/xml");
  const rowNodes=[...doc.getElementsByTagName("row")];
  const matrix=new Map<number,Map<number,string>>();
  for(const rowNode of rowNodes){
    const r=Number(rowNode.getAttribute("r")||0);
    if(!r) continue;
    const cells=new Map<number,string>();
    for(const cell of [...rowNode.getElementsByTagName("c")]){
      const ref=cell.getAttribute("r")||"";
      const letters=ref.match(/[A-Z]+/)?.[0]||"";
      let col=0;
      for(const ch of letters) col=col*26+(ch.charCodeAt(0)-64);
      if(col) cells.set(col-1,cellValue(cell,shared));
    }
    matrix.set(r,cells);
  }

  const header=STUDENT_IMPORT_HEADERS.map((_,i)=>matrix.get(1)?.get(i)?.trim()??"");
  const headerMismatch=STUDENT_IMPORT_HEADERS.some((expected,i)=>header[i]!==expected);
  if(headerMismatch){
    return {rows,issues:[{row:1,message:"Header template berubah. Unduh ulang template resmi ONE PRO dan jangan ubah nama kolom."}],fileName:file.name,totalRows:0};
  }

  const usedRows=[...matrix.keys()].filter(r=>r>=2).sort((a,b)=>a-b);
  if(usedRows.length>500) issues.push({row:0,message:"Maksimal 500 siswa dalam satu import."});
  const seen=new Set<string>();
  const existingKeys=new Set(existing.filter(item=>item.group_id===groupId).map(item=>`${item.full_name.trim().toLowerCase()}|${item.birth_date??""}`));

  for(const rowNumber of usedRows.slice(0,500)){
    const cells=matrix.get(rowNumber)??new Map<number,string>();
    const values=STUDENT_IMPORT_HEADERS.map((_,i)=>(cells.get(i)??"").trim());
    if(values.every(v=>!v)) continue;

    const [fullName,nickname,gradeRaw,birthPlace,birthDateRaw,address,phone,fatherName,fatherPhone,motherName,motherPhone,showPhotoRaw,statusRaw]=values;
    const rowIssues: ImportIssue[]=[];
    if(!fullName) rowIssues.push({row:rowNumber,field:"Nama Lengkap",message:"Nama Lengkap wajib diisi."});
    const grade=normalizeGrade(gradeRaw);
    if(grade===null) rowIssues.push({row:rowNumber,field:"Jenjang",message:"Jenjang harus PAUD atau SD 1 sampai SD 6."});

    let birthDate=birthDateRaw;
    if(birthDate && /^\d+(\.\d+)?$/.test(birthDate)) birthDate=serialToDate(birthDate);
    if(birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) rowIssues.push({row:rowNumber,field:"Tanggal Lahir",message:"Gunakan format YYYY-MM-DD."});
    if(birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && Number.isNaN(new Date(`${birthDate}T12:00:00`).getTime())) rowIssues.push({row:rowNumber,field:"Tanggal Lahir",message:"Tanggal lahir tidak valid."});

    const showPhoto=normalizeBoolean(showPhotoRaw);
    if(showPhoto===null) rowIssues.push({row:rowNumber,field:"Tampilkan Foto",message:"Gunakan Ya atau Tidak."});
    const status=normalizeStatus(statusRaw);
    if(status===null) rowIssues.push({row:rowNumber,field:"Status",message:"Gunakan Aktif atau Nonaktif."});

    for(const [field,val] of [["Nomor HP Anak",phone],["WhatsApp Ayah",fatherPhone],["WhatsApp Ibu",motherPhone]] as const){
      if(val && !/^[+0-9 ()-]{6,24}$/.test(val)) rowIssues.push({row:rowNumber,field,message:"Format nomor telepon tidak valid."});
    }

    const key=`${fullName.toLowerCase()}|${birthDate||""}`;
    if(fullName && seen.has(key)) rowIssues.push({row:rowNumber,message:"Baris duplikat di file (nama dan tanggal lahir sama)."});
    if(fullName && existingKeys.has(key)) rowIssues.push({row:rowNumber,message:"Siswa dengan nama dan tanggal lahir yang sama sudah ada di database kelompok."});
    seen.add(key);

    issues.push(...rowIssues);
    if(!rowIssues.length && grade!==null && showPhoto!==null && status!==null){
      rows.push({
        group_id:groupId,
        full_name:fullName,
        nickname:nickname||null,
        school_grade:grade,
        birth_place:birthPlace||null,
        birth_date:birthDate||null,
        address:address||null,
        phone:normalizePhone(phone),
        father_name:fatherName||null,
        father_phone:normalizePhone(fatherPhone),
        mother_name:motherName||null,
        mother_phone:normalizePhone(motherPhone),
        show_photo:showPhoto,
        status,
      });
    }
  }

  return {rows,issues,fileName:file.name,totalRows:usedRows.filter(r=>STUDENT_IMPORT_HEADERS.some((_,i)=>(matrix.get(r)?.get(i)??"").trim())).length};
}
