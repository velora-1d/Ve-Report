# MENU.md — Struktur Menu & Filter

Seluruh label menu dalam Bahasa Indonesia.

## Filter Global

Tersedia konsisten di setiap menu (posisi sama):

- **Pencarian** — cari berdasarkan judul/kata kunci
- **Rentang Tanggal** — dari-sampai, berlaku di menu yang punya elemen tanggal
- **Pengguna** — filter berdasarkan user (Admin/Dev only; Staff otomatis ter-filter ke dirinya sendiri)

## Daftar Menu

### 0. Login
- Form: Email, Password
- Pesan error dalam Bahasa Indonesia
- (Fase 2, opsional): "Ingat saya", Lupa password

### 1. Dasbor
- Ringkasan tugas hari ini (jumlah Belum Dikerjakan/Dikerjakan/Selesai)
- Progres mingguan (grafik sederhana)
- Deadline mendekat (3-5 hari ke depan)
- Aktivitas terbaru
- (Admin/Dev): ringkasan seluruh tim

### 2. Tugas & Jadwal
**Tab: Daftar Tugas**
- List semua tugas (status, prioritas, assignee, deadline)
- Buat tugas baru — judul, deskripsi, assignee, prioritas, deadline
- Detail tugas — histori status, catatan
- Ubah status (Belum Dikerjakan → Dikerjakan → Ditinjau → Selesai)
- Assign/reassign tugas (Admin/Dev only)
- Filter: Status, Prioritas, Ditugaskan ke, Terlambat

**Tab: Kalender**
- Tampilan: Harian / Mingguan / Bulanan / Tahunan
- Input jadwal lengkap: tanggal (hari, bulan, tahun), jam mulai, jam selesai
- Bisa berdiri sendiri atau terhubung ke Tugas
- Reminder (menit/jam sebelum waktu mulai)
- Navigasi cepat: tombol "Hari ini", pilih tahun langsung
- Filter: Tampilan, Terhubung Tugas, Rentang Tanggal

### 3. Pelacak
- Catat progress/waktu per tugas (durasi, catatan, tanggal)
- Riwayat log per tugas & per user
- Ringkasan total waktu per tugas/per user
- Filter: Per Tugas, Per Pengguna, Durasi

### 4. Laporan
- Generate laporan by periode (harian/mingguan/bulanan/custom)
- Filter saat generate: user, status, prioritas
- Preview sebelum export
- Export ke PDF
- Riwayat laporan yang pernah dibuat
- Filter: Periode, Status Laporan, Pengguna

### 5. Manajemen Pengguna (Admin & Dev)
- Tambah/edit/nonaktifkan user
- Atur role
- Reset password user
- (Akun Developer tidak muncul di list ini)

### 6. Pengaturan
**Sub: Profil Saya**
- Foto profil (upload gambar)
- Biodata: Nama lengkap, Email, No. Telepon, Jabatan/Posisi, Bio singkat
- Ubah password

**Sub: Branding & Logo** (Admin/Dev only)
- Upload Logo Aplikasi — dipakai di Login, Sidebar, Header PDF
- Preview sebelum simpan

**Sub: Konfigurasi PDF** (Admin/Dev only)
- Ukuran kertas: A4 / Letter / Legal
- Orientasi: Potrait / Landscape
- Header PDF: teks custom + logo
- Footer PDF: teks custom
- Margin: default / custom

### 7. Panel Developer (Dev only, tersembunyi dari menu biasa)
- Log sistem (filter: Tipe Log, Level Severity, Rentang Waktu)
- Status database (koneksi, ukuran)
- Konfigurasi Telegram bot (token, chat ID)
- Uji coba notifikasi Telegram
