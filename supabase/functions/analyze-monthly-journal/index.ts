import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RUBRIC_VERSION = "one-pro-journal-v1";
const SYSTEM_PROMPT = `Anda adalah analis pendidikan ONE PRO JURNAL DIGITAL. Analisis laporan pengajian bulanan berdasarkan DATA SAJA. Jangan mengarang fakta, diagnosis, atau kondisi murid. Jika data kurang, tulis secara eksplisit bahwa data belum cukup. Gunakan bahasa Indonesia profesional, ringkas, operasional, dan mudah dipahami PJ Kelompok/guru. Rubrik standar v1: sesi pengajian menilai keterlaksanaan materi, keaktifan kelas, pemahaman umum, serta adab/kedisiplinan pada skala 1-4. Individu menilai kemajuan target, pemahaman, praktik/keterampilan, kemandirian, serta adab/partisipasi pada skala 1-4. Hasil WAJIB JSON valid dengan struktur: {"summary":"...","strengths":["..."],"attention":["..."],"students_needing_support":[{"student_id":"uuid","name":"...","reason":"...","next_action":"..."}],"class_recommendations":["..."],"next_month_focus":["..."],"data_quality":{"status":"cukup|terbatas","notes":["..."]},"rubric_version":"one-pro-journal-v1"}. Jangan sertakan markdown.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type" } });
  try {
    const auth = req.headers.get("authorization");
    if (!auth) return jsonResponse({ error: "Sesi login diperlukan." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, service);
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Sesi tidak valid." }, 401);
    const { classId, month } = await req.json();
    if (!classId || !/^\d{4}-\d{2}$/.test(month || "")) return jsonResponse({ error: "Kelas dan bulan wajib diisi." }, 400);
    const { data: klass } = await caller.from("classes").select("id,name,group_id").eq("id", classId).single();
    if (!klass) return jsonResponse({ error: "Kelas tidak dapat diakses." }, 403);
    const start = `${month}-01`;
    const [year, mon] = month.split("-").map(Number);
    const end = `${month}-${String(new Date(year, mon, 0).getDate()).padStart(2,"0")}`;
    const [journals, attendanceSessions, enrollments, targets] = await Promise.all([
      caller.from("daily_journals").select("id,journal_date,material,achievement,obstacles,improvement_plan,notes,rubric_version,session_assessment,student_progress(id,student_id,target_id,progress_value,progress_note,assessment,follow_up,students(full_name,school_grade))").eq("class_id", classId).gte("journal_date", start).lte("journal_date", end).order("journal_date"),
      caller.from("attendance_sessions").select("id,session_date,attendance_records(student_id,status)").eq("class_id", classId).gte("session_date", start).lte("session_date", end).order("session_date"),
      caller.from("class_enrollments").select("student_id,students(full_name,school_grade,status)").eq("class_id", classId).is("ended_on", null),
      caller.from("targets").select("id,school_grade,code,title,description,target_value,target_unit").order("school_grade").order("sort_order"),
    ]);
    const snapshot = { rubric_version: RUBRIC_VERSION, class: klass, period: { start, end }, journals: journals.data || [], attendance_sessions: attendanceSessions.data || [], enrollments: enrollments.data || [], targets: targets.data || [] };
    const source = JSON.stringify(snapshot);
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    const sourceHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,"0")).join("");
    const { data: existing } = await caller.from("reports").select("id,summary,status").eq("class_id", classId).eq("kind", "monthly_journal").eq("period_start", start).eq("period_end", end).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let reportId = existing?.id;
    if (!reportId) {
      const created = await caller.from("reports").insert({ class_id: classId, period_start: start, period_end: end, kind: "monthly_journal", status: "processing", created_by: userData.user.id, summary: { rubric_version: RUBRIC_VERSION } }).select("id").single();
      if (created.error) throw created.error;
      reportId = created.data.id;
    }
    const { data: cached } = await caller.from("ai_analyses").select("output,model,created_at").eq("report_id", reportId).eq("analysis_type", "monthly_journal_v1").eq("source_hash", sourceHash).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (cached?.output) return jsonResponse({ report_id: reportId, analysis: cached.output, model: cached.model, cached: true });
    const keys = [Deno.env.get("GEMINI_API_KEY_1"), Deno.env.get("GEMINI_API_KEY_2"), Deno.env.get("GEMINI_API_KEY_3")].filter(Boolean) as string[];
    let analysis: any = null;
    let model = "rules-v1";
    let lastError = "";
    const prompt = `${SYSTEM_PROMPT}\n\nDATA:\n${source}`;
    for (const key of keys) {
      for (const candidate of ["gemini-2.5-flash", "gemini-2.5-flash-lite"]) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 3000 } }) });
          const body = await res.json();
          if (!res.ok) { lastError = body?.error?.message || `Gemini ${res.status}`; continue; }
          const text = body?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("") || "";
          analysis = JSON.parse(text);
          model = candidate;
          break;
        } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
      }
      if (analysis) break;
    }
    if (!analysis) {
      const journalsCount = (journals.data || []).length;
      const individualCount = (journals.data || []).reduce((n:any,j:any)=>n+(j.student_progress?.length||0),0);
      const attendance = (attendanceSessions.data || []).flatMap((s:any)=>s.attendance_records||[]);
      const hadir = attendance.filter((r:any)=>r.status==="hadir").length;
      const rate = attendance.length ? Math.round(hadir/attendance.length*100) : 0;
      analysis = { summary: journalsCount ? `Terdapat ${journalsCount} jurnal pengajian pada bulan ini dengan kehadiran tercatat ${rate}%.` : "Data jurnal bulan ini belum cukup untuk analisis AI lengkap.", strengths: rate>=85?[`Kehadiran tercatat ${rate}% pada data yang tersedia.`]:[], attention: journalsCount<2?["Jumlah jurnal pengajian masih terbatas sehingga tren bulanan belum kuat."]:[], students_needing_support: [], class_recommendations: ["Lengkapi jurnal pengajian setiap pertemuan.", "Isi penilaian individu berbasis target untuk murid yang memerlukan pemantauan."], next_month_focus: ["Konsistensi jurnal dan penilaian individu."], data_quality: { status: journalsCount>=2 && individualCount>0 ? "cukup" : "terbatas", notes: [`${journalsCount} jurnal pengajian`, `${individualCount} penilaian individu`, lastError ? "Layanan AI eksternal belum tersedia; hasil sementara memakai analisis standar berbasis aturan." : "Analisis standar digunakan."] }, rubric_version: RUBRIC_VERSION };
    }
    analysis.rubric_version = RUBRIC_VERSION;
    const write = await admin.from("ai_analyses").insert({ report_id: reportId, analysis_type: "monthly_journal_v1", model, input_snapshot: snapshot, output: analysis, source_hash: sourceHash });
    if (write.error) throw write.error;
    await admin.from("reports").update({ status: "ready", summary: analysis, updated_at: new Date().toISOString() }).eq("id", reportId);
    return jsonResponse({ report_id: reportId, analysis, model, cached: false });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Analisis gagal diproses." }, 500);
  }
});
