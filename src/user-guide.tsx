import { BookOpen, CalendarBlank, ChartLineUp, CheckCircle, ClipboardText, Database, DownloadSimple, Info, ShieldCheck, UploadSimple, Users } from "@phosphor-icons/react";
import "./user-guide.css";

type Role = "Pengajar" | "PJ Kelompok" | "Admin Desa" | "Admin Daerah" | "Super Admin";

const roleNotes: Record<Role, { title: string; steps: string[] }> = {
  "Super Admin": {
    title: "Super Admin",
    steps: [
      "Kelola akun, role, status aktif, dan riwayat login melalui menu Super Admin.",
      "Gunakan AI Sistem untuk menanyakan fungsi aplikasi dan data agregat web.",
      "Gunakan Informasi untuk melihat struktur aplikasi, koneksi, dan ringkasan data.",
    ],
  },
  "Admin Daerah": {
    title: "Admin Daerah",
    steps: [
      "Pantau Desa → Kelompok → Kelas melalui Beranda dan menu Wilayah.",
      "Pilih Kelompok lalu Kelas sebelum membuka Agenda, Presensi, Jurnal, Database Anak, dan Laporan.",
      "Kelola target daerah dan tim di bawah daerah. Data operasional tetap diinput PJ/Pengajar.",
    ],
  },
  "Admin Desa": {
    title: "Admin Desa",
    steps: [
      "Pantau seluruh kelompok yang berada di bawah desa.",
      "Pilih Kelompok lalu Kelas sebelum membaca Agenda, Presensi, Jurnal, Database Anak, dan Laporan.",
      "Kelola kelompok serta akun PJ/Pengajar di lingkup desa tanpa mengubah data operasional siswa.",
    ],
  },
  "PJ Kelompok": {
    title: "PJ Kelompok",
    steps: [
      "Kelola database anak, pembagian kelas, guru penanggung jawab, agenda, presensi, dan jurnal.",
      "Gunakan Template Excel resmi untuk memasukkan banyak siswa sekaligus.",
      "Pastikan setiap anak hanya berada di satu kelas aktif dan setiap guru maksimal memegang dua kelas.",
    ],
  },
  "Pengajar": {
    title: "Pengajar",
    steps: [
      "Buka kelas yang ditugaskan, isi presensi, jurnal pengajian, dan perkembangan individu.",
      "Gunakan Agenda untuk melihat kegiatan kelas dan Laporan untuk melihat hasil bulanan.",
      "Pengajar hanya bekerja pada 1–2 kelas yang telah ditentukan PJ Kelompok.",
    ],
  },
};

function StepCard({ number, title, text }: { number: number; title: string; text: string }) {
  return <article className="guide-step"><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></article>;
}

export function UserGuide({ role }: { role: Role }) {
  const current=roleNotes[role];
  return <section className="guide-page">
    <header className="guide-hero">
      <span><BookOpen size={25} weight="duotone"/></span>
      <div><em>PANDUAN ONE PRO</em><h1>Panduan Penggunaan</h1><p>Alur singkat penggunaan aplikasi berdasarkan role. Gunakan panduan ini sebagai rujukan saat pertama kali menggunakan fitur.</p></div>
    </header>

    <section className="guide-role-panel">
      <div><span>AKSES SAAT INI</span><h2>{current.title}</h2></div>
      <div className="guide-role-steps">{current.steps.map((step,index)=><div key={step}><CheckCircle size={17}/><span>{step}</span></div>)}</div>
    </section>

    <section className="guide-section">
      <header><Database size={19}/><div><span>DATABASE ANAK</span><h2>Import siswa dengan Excel</h2></div></header>
      <div className="guide-steps">
        <StepCard number={1} title="Unduh template resmi" text="Buka Database Anak lalu pilih Template Excel. Jangan mengubah nama kolom pada baris pertama."/>
        <StepCard number={2} title="Isi data" text="Nama Lengkap dan Jenjang wajib diisi. Tanggal lahir memakai format YYYY-MM-DD. Nomor HP sebaiknya tetap sebagai teks."/>
        <StepCard number={3} title="Upload & validasi" text="Pilih Import Excel. Sistem memeriksa format file, nilai jenjang, tanggal, status, nomor telepon, dan data duplikat."/>
        <StepCard number={4} title="Konfirmasi import" text="Import hanya dapat dijalankan jika seluruh baris lolos validasi. Data masuk ke kelompok PJ yang sedang aktif."/>
      </div>
      <div className="guide-note"><ShieldCheck size={18}/><span><strong>Import aman</strong><small>File maksimal 500 siswa. Baris bermasalah ditampilkan terlebih dahulu dan tidak langsung disimpan ke database.</small></span></div>
    </section>

    <section className="guide-grid">
      <article><CalendarBlank size={20}/><strong>Agenda</strong><p>Jadwal dapat dibuat rutin mingguan atau satu tanggal. Jadwal rutin dapat dilewati hanya pada satu tanggal saat libur.</p></article>
      <article><Users size={20}/><strong>Presensi</strong><p>Isi Hadir, Izin, atau Alpha per kelas. Rekap bulanan menghitung jumlah dan persentase setiap siswa.</p></article>
      <article><ClipboardText size={20}/><strong>Jurnal</strong><p>Catat kegiatan pengajian dan perkembangan individu. Data bulanan digunakan untuk analisis dan laporan.</p></article>
      <article><ChartLineUp size={20}/><strong>Laporan</strong><p>Pilih kelompok, kelas, dan bulan. Laporan Word/PPT memakai data hanya dari lingkup yang dipilih.</p></article>
    </section>

    <section className="guide-section compact">
      <header><Info size={19}/><div><span>ALUR PENTING</span><h2>Prinsip penggunaan ONE PRO</h2></div></header>
      <div className="guide-principles">
        <div><strong>Daerah → Desa → Kelompok → Kelas</strong><span>Monitoring selalu mengikuti struktur naungan.</span></div>
        <div><strong>Operasional di PJ/Pengajar</strong><span>Admin wilayah memonitor, bukan mengubah jurnal atau presensi.</span></div>
        <div><strong>Data bulanan</strong><span>Presensi, jurnal, dan laporan mengikuti bulan yang dipilih.</span></div>
        <div><strong>Riwayat tetap aman</strong><span>Nonaktifkan data bila sudah tidak digunakan; jangan hapus histori operasional.</span></div>
      </div>
    </section>

    <div className="guide-download-hint"><DownloadSimple size={18}/><UploadSimple size={18}/><span>Untuk import siswa, gunakan selalu template dari menu Database Anak agar format tervalidasi.</span></div>
  </section>;
}
