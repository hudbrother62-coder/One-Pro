# One Pro Jurnal Digital

Aplikasi operasional pengajian Malang Timur untuk agenda, presensi, jurnal, target, perkembangan individu, laporan, komunikasi, dan audit anggota.

## Struktur wilayah

- Daerah Malang Timur
- 3 desa: Mangliawan, Sawojajar, Cibuni
- 16 kelompok

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Tanpa variabel Supabase, antarmuka berjalan memakai data demonstrasi. Setelah proyek Supabase tersambung, gunakan publishable key di klien; tiga API key Gemini hanya boleh disimpan sebagai secret server.

## Pemeriksaan

```bash
npm run check:runtime
npm run build
npm test
```

Skema awal tersedia di `supabase/migrations/202609120001_initial_schema.sql`.

