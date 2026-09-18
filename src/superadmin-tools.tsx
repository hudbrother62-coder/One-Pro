import { useEffect, useMemo, useRef, useState } from "react";
import { Buildings, ChatCircleDots, CheckCircle, Database, Info, PaperPlaneTilt, Robot, ShieldCheck, Student, Users } from "@phosphor-icons/react";
import { supabase } from "./lib/supabase";
import type { WorkspaceData } from "./lib/data";
import "./superadmin-tools.css";

type Message = { role: "user" | "assistant"; text: string };
type Notify = (message: string) => void;

export function SuperAdminAI({ notify }: { notify: Notify }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Saya siap membantu membaca kondisi sistem ONE PRO, struktur role, fungsi menu, dan data agregat web. Contoh: “berapa kelompok aktif?”, “jelaskan alur Admin Desa”, atau “bagaimana kondisi presensi bulan ini?”" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const send = async () => {
    const clean = input.trim();
    if (!clean || loading) return;
    setInput("");
    setMessages(current => [...current, { role: "user", text: clean }]);
    if (!supabase) { notify("Supabase belum terhubung"); return; }
    setLoading(true);
    try {
      const history = messages.slice(-8);
      const { data, error } = await supabase.functions.invoke("super-admin-ai", { body: { message: clean, history } });
      if (error) throw error;
      const answer = String((data as { answer?: string } | null)?.answer ?? "").trim();
      if (!answer) throw new Error("Jawaban AI kosong");
      setMessages(current => [...current, { role: "assistant", text: answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Asisten sistem gagal dihubungi";
      setMessages(current => [...current, { role: "assistant", text: `Maaf, permintaan belum dapat diproses. ${message}` }]);
      notify(message);
    } finally {
      setLoading(false);
    }
  };

  return <section className="super-ai-page">
    <header className="super-tool-hero">
      <span className="super-tool-icon"><Robot size={24} weight="duotone" /></span>
      <div><span>SUPER ADMIN</span><h1>Asisten Sistem</h1><p>Tanya tentang fungsi ONE PRO, struktur akses, kondisi sistem, dan data agregat aplikasi tanpa membuka data pribadi mentah.</p></div>
    </header>
    <div className="super-ai-guard"><ShieldCheck size={18}/><span><strong>Privasi sistem</strong><small>AI menerima statistik, struktur organisasi, dan informasi sistem. Password, token, alamat, nomor telepon, serta catatan individu mentah tidak dikirim ke model.</small></span></div>
    <div className="super-ai-suggestions">
      {["Ringkas kondisi ONE PRO saat ini","Berapa daerah, desa, kelompok, kelas, dan siswa aktif?","Jelaskan akses Admin Daerah dan Admin Desa","Bagaimana kondisi presensi bulan ini?"].map(question =>
        <button key={question} onClick={() => setInput(question)}>{question}</button>
      )}
    </div>
    <section className="super-ai-chat">
      <div className="super-ai-messages">
        {messages.map((message,index)=><article key={index} className={message.role === "user" ? "mine" : "assistant"}>
          <span>{message.role === "assistant" ? <Robot size={17}/> : <Users size={17}/>}</span>
          <p>{message.text}</p>
        </article>)}
        {loading ? <article className="assistant loading"><span><Robot size={17}/></span><p>Membaca snapshot sistem…</p></article> : null}
        <div ref={endRef}/>
      </div>
      <div className="super-ai-composer">
        <textarea value={input} onChange={event=>setInput(event.target.value)} placeholder="Tanya tentang sistem atau data web…" rows={2} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void send();}}}/>
        <button disabled={!input.trim()||loading} onClick={()=>void send()} aria-label="Kirim pertanyaan"><PaperPlaneTilt size={19} weight="fill"/></button>
      </div>
    </section>
  </section>;
}

export function SystemInformation({ workspace }: { workspace: WorkspaceData }) {
  const [roles,setRoles]=useState<Record<string,{total:number;active:number}>>({});
  const [connected,setConnected]=useState<boolean>(Boolean(supabase));

  useEffect(()=>{
    if(!supabase)return;
    let mounted=true;
    supabase.from("memberships").select("role,is_active").then(({data,error})=>{
      if(!mounted)return;
      if(error){setConnected(false);return;}
      const next:Record<string,{total:number;active:number}>={};
      for(const item of data??[]){
        const key=String(item.role);
        next[key]??={total:0,active:0};
        next[key].total++;
        if(item.is_active)next[key].active++;
      }
      setRoles(next);
      setConnected(true);
    });
    return()=>{mounted=false};
  },[]);

  const activeClasses=workspace.classes.filter(item=>item.is_active).length;
  const activeStudents=workspace.students.filter(item=>item.status==="active").length;
  const roleTotal=useMemo(()=>Object.values(roles).reduce((sum,item)=>sum+item.active,0),[roles]);

  return <section className="system-info-page">
    <header className="super-tool-hero">
      <span className="super-tool-icon"><Info size={24} weight="duotone"/></span>
      <div><span>INFORMASI WEB</span><h1>ONE PRO Jurnal Digital</h1><p>Ringkasan struktur aplikasi, koneksi, jumlah data, dan pembagian akses yang sedang digunakan.</p></div>
    </header>
    <div className="system-health-strip">
      <article><CheckCircle size={19}/><span><strong>Production</strong><small>one-pro-cyan.vercel.app</small></span></article>
      <article><Database size={19}/><span><strong>{connected?"Terhubung":"Periksa koneksi"}</strong><small>Supabase database & auth</small></span></article>
      <article><ShieldCheck size={19}/><span><strong>RLS aktif</strong><small>Akses mengikuti role dan wilayah</small></span></article>
    </div>
    <div className="system-info-grid">
      <article><Buildings size={20}/><span><strong>{workspace.areas.length}</strong><small>Daerah</small></span></article>
      <article><Buildings size={20}/><span><strong>{workspace.villages.length}</strong><small>Desa</small></span></article>
      <article><Buildings size={20}/><span><strong>{workspace.groups.length}</strong><small>Kelompok</small></span></article>
      <article><Users size={20}/><span><strong>{activeClasses}</strong><small>Kelas aktif</small></span></article>
      <article><Student size={20}/><span><strong>{activeStudents}</strong><small>Siswa aktif</small></span></article>
      <article><Users size={20}/><span><strong>{roleTotal}</strong><small>Akun aktif</small></span></article>
    </div>
    <section className="system-info-panel">
      <header><div><span>STRUKTUR AKSES</span><h2>Role dan tanggung jawab</h2></div></header>
      <div className="system-role-list">
        {[
          ["Super Admin","Platform, user, informasi web, dan AI sistem"],
          ["Admin Daerah","Monitoring Daerah → Desa → Kelompok → Kelas, target, wilayah, tim"],
          ["Admin Desa","Monitoring Desa → Kelompok → Kelas dan koordinasi tim"],
          ["PJ Kelompok","Operasional kelompok, siswa, kelas, agenda, presensi, jurnal"],
          ["Pengajar","Operasional 1–2 kelas yang ditugaskan"],
        ].map(([name,detail])=><article key={name}><span><strong>{name}</strong><small>{detail}</small></span></article>)}
      </div>
    </section>
    <section className="system-info-panel">
      <header><div><span>TEKNOLOGI</span><h2>Arsitektur aplikasi</h2></div></header>
      <div className="system-tech-grid">
        <article><strong>React + TypeScript + Vite</strong><small>Frontend aplikasi</small></article>
        <article><strong>Supabase</strong><small>Database, autentikasi, RLS, realtime, storage, Edge Functions</small></article>
        <article><strong>Vercel</strong><small>Production hosting dan deployment</small></article>
        <article><strong>Gemini Flash / Flash Lite</strong><small>Analisis jurnal dan asisten sistem dengan fallback terkontrol</small></article>
      </div>
    </section>
  </section>;
}
