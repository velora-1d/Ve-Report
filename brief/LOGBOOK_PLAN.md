# LOGBOOK_PLAN.md — Rencana Implementasi Template Log Book

Dokumen ini menjelaskan rencana implementasi untuk mereplikasi format template Excel yang ditemukan di `/home/pak-hakim/Hakim/Worker/log book file (1).xlsx` ke dalam aplikasi **Ve-Report**.

Template ini terbagi menjadi dua lembar kerja (sheets):

1. **Log book meeting** (Penugasan Atasan / Hasil Meeting)
2. **Log book harian** (Log Kegiatan Harian)

---

## 1. Pemetaan Struktur Template ke Database

Untuk menyimpan data yang sesuai dengan kolom-kolom pada template Excel, kita perlu melakukan beberapa pembaruan schema pada database Supabase (melalui migrasi baru):

### A. Lembar "Log book meeting"

Tabel `tasks` saat ini memiliki kolom dasar (`title`, `description`, `due_date`, `status`, `assigned_to`, `created_by`). Kita perlu memetakan/menambahkan kolom baru berikut:

- **Hari / Tanggal:** Menggunakan `tasks.created_at`.
- **Uraian Tugas:** Menggunakan `tasks.title` dan `tasks.description`.
- **Pemberi Tugas:**
  - **Atasan:** Jika pemberi tugas adalah individu (diambil dari `profiles.name` berdasarkan `tasks.created_by`).
  - **Meeting:** Apakah tugas ini bersumber dari hasil meeting.
  - _Usulan Kolom Baru:_ `task_source` (Enum/Text: `'atasan' | 'meeting'`).
- **Target Selesai:** Menggunakan `tasks.due_date`.
- **Out Put:** Hasil akhir tugas.
  - _Usulan Kolom Baru:_ `output_description` (Text) untuk mencatat bukti/output fisik atau dokumen hasil tugas.

### B. Lembar "Log book harian"

Tabel `tracker_logs` saat ini hanya mencatat `logged_date`, `duration_minutes`, dan `note`. Kita perlu menambahkan kolom baru agar sesuai template:

- **Hari / Tanggal:** Menggunakan `tracker_logs.logged_date`.
- **Jam (Mulai - Selesai):** Saat ini durasi hanya dalam menit.
  - _Usulan Kolom Baru:_ `start_time` (Time/Text, contoh: `"08:00"`) dan `end_time` (Time/Text, contoh: `"17:00"`).
- **Implementasi Kegiatan:** Deskripsi kegiatan yang diisi di `tracker_logs.note`.
- **Status (On Progress / Selesai):** Status tugas terkait (`tasks.status`).
- **Validasi Atasan:** Kolom persetujuan atasan.
  - _Usulan Kolom Baru:_ `is_validated` (Boolean, default: `false`) dan `validated_by` (UUID ke `profiles.id`).
- **Keterangan:** Catatan tambahan atau remark.
  - _Usulan Kolom Baru:_ `remarks` (Text).

---

## 2. Rencana Implementasi Langkah demi Langkah

### Langkah 1: Migrasi Database (Supabase SQL)

Membuat file migrasi baru di `supabase/migrations/` untuk menambahkan kolom-kolom baru:

```sql
ALTER TABLE public.tasks
  ADD COLUMN task_source VARCHAR(20) DEFAULT 'atasan',
  ADD COLUMN output_description TEXT;

ALTER TABLE public.tracker_logs
  ADD COLUMN start_time VARCHAR(10) DEFAULT '08:00',
  ADD COLUMN end_time VARCHAR(10) DEFAULT '17:00',
  ADD COLUMN is_validated BOOLEAN DEFAULT false,
  ADD COLUMN validated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN remarks TEXT;
```

### Langkah 2: Pembaruan Form Input di Front-end

1. **Form Tambah/Edit Tugas ([task-form-dialog.tsx](file:///home/pak-hakim/Hakim/Project/Ve-Report/src/components/tasks/task-form-dialog.tsx))**:
   - Menambahkan input Pilihan/Select: "Sumber Tugas" (Atasan / Hasil Meeting).
   - Menambahkan text input: "Deskripsi Output" (Out Put).
2. **Form Input Pelacak Waktu ([tracker-form-dialog.tsx](file:///home/pak-hakim/Hakim/Project/Ve-Report/src/components/tracker/tracker-form-dialog.tsx))**:
   - Menambahkan input jam mulai (`start_time`) dan jam selesai (`end_time`).
   - Menambahkan input text: "Keterangan Tambahan".
3. **Validasi Atasan (Fitur Baru)**:
   - Membuat halaman/panel khusus bagi Admin/Atasan untuk menyetujui (validasi) log book harian staf (mengubah status `is_validated` menjadi `true`).

### Langkah 3: Ekspor Laporan (Excel & PDF)

Untuk menghasilkan laporan yang persis dengan template Excel yang diberikan:

1. **Ekspor Excel (.xlsx)**:
   - Menggunakan library `exceljs` di front-end untuk me-render spreadsheet secara dinamis.
   - Menulis kode generator yang mengatur font, border, merged cells, warna header, tanda tangan (Yang Membuat & Yang Mengetahui), serta lokasi ("Jonggol, [Tanggal]").
2. **Ekspor PDF**:
   - Memperbarui [pdf-report.ts](file:///home/pak-hakim/Hakim/Project/Ve-Report/src/lib/pdf-report.ts) untuk mendukung layout cetak yang mirip dengan tabel di lembar Excel (dengan style minimalis, border tebal di judul, area tanda tangan di bagian bawah halaman terakhir).

---

## Pertanyaan / Keputusan Desain yang Perlu Disepakati:

1. **Fitur Ekspor**: Apakah Anda ingin fitur ekspor menghasilkan file **Excel (.xlsx)** asli, file **PDF**, atau **keduanya**? (Rekomendasi: Keduanya).
2. **Format Tanda Tangan**: Siapa yang akan dipilih sebagai "Yang Mengetahui"? Apakah diambil otomatis dari Atasan/Admin divisi tersebut atau user dapat memilih nama Atasan saat men-generate laporan?
3. **Metode Validasi**: Apakah persetujuan atasan dilakukan lewat aplikasi (sehingga kolom "Validasi Atasan" akan terisi tanda centang/nama atasan jika sudah di-approve di web) atau diisi manual setelah dicetak?
