# Impala Analyzer (Next.js + PostgreSQL)

    npm install
    npm run build && npm start      # http://localhost:3000   (dev: npm run dev)

1. Buka aplikasi pertama kali → buat akun master (username/password).
2. Tab **Pengaturan** → isi koneksi PostgreSQL → *Simpan & siapkan tabel* (tabel dibuat otomatis).
3. Tab **Cluster** → tambah cluster (URL coordinator, user, password, interval sync).
4. Tab **Analisis** → tabel, filter ala Ranger, atur kolom, unduh CSV.

Konfigurasi master & DB disimpan di `./data/config.json` (ubah lokasi dengan env `DATA_DIR`).
Jalankan sebagai **satu proses** (scheduler berjalan di dalam server Next.js); jangan skala >1 replika.

ALTER TABLE clusters ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'url';