from pathlib import Path

p=Path('src/Prototype.tsx')
s=p.read_text()
s=s.replace('if (!previewMode && supabase) { const classIds = classFilter === "all" ? workspace.classes.filter((item) => item.is_active).map((item) => item.id) : [classFilter]; await Promise.allSettled(classIds.map((classId) => supabase.functions.invoke("analyze-monthly-journal", { body: { classId, month } }))); }', 'const reportClient = supabase; if (!previewMode && reportClient) { const classIds = classFilter === "all" ? workspace.classes.filter((item) => item.is_active).map((item) => item.id) : [classFilter]; await Promise.allSettled(classIds.map((classId) => reportClient.functions.invoke("analyze-monthly-journal", { body: { classId, month } }))); }')
p.write_text(s)

p=Path('src/operations-workspace.tsx')
s=p.read_text()
s=s.replace('Gunakan placeholder seperti {{NAMA_KELAS}}, {{BULAN}}, {{RATA_KEHADIRAN}}, {{RINGKASAN}}, {{KEKUATAN}}, dan {{REKOMENDASI}}. Template kompleks tetap divalidasi sebelum generator PPT diaktifkan.', 'Gunakan placeholder standar NAMA_KELAS, BULAN, RATA_KEHADIRAN, RINGKASAN, KEKUATAN, dan REKOMENDASI. Template kompleks tetap divalidasi sebelum generator PPT diaktifkan.')
p.write_text(s)
