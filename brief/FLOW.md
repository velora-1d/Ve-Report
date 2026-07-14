# FLOW.md — Alur Proses Aplikasi

## 1. Alur Login

```
User buka aplikasi → Form Login (email + password)
  → Berhasil → cek role → arahkan ke Dasbor sesuai role
  → Gagal → tampilkan pesan error (toast custom) → hitung percobaan gagal
     → 5x gagal → akun terkunci 15 menit + catat log
```

## 2. Alur Siklus Tugas

```
Admin/Dev buat tugas baru
  → Isi: judul, deskripsi, assignee, prioritas, deadline
  → Status awal: Belum Dikerjakan
  → Notifikasi in-app muncul ke assignee

Staff buka tugas miliknya
  → Ubah status: Belum Dikerjakan → Dikerjakan → Ditinjau → Selesai
  → Setiap ubah status, disarankan isi catatan singkat
  → Setiap perubahan status tercatat di histori tugas

Saat status jadi "Selesai"
  → completedAt otomatis terisi
  → Muncul di ringkasan Dasbor sebagai tugas selesai
```

## 3. Alur Jadwal (dalam tab Kalender)

```
User buat jadwal baru
  → Isi tanggal (hari, bulan, tahun) + jam mulai + jam selesai
  → Bisa berdiri sendiri atau pilih "hubungkan ke Tugas"
  → Set reminder (menit/jam sebelum waktu mulai)
  → Muncul di kalender sesuai tanggal & jam

Jika terhubung ke tugas
  → Update status tugas otomatis tercermin di kartu jadwal (badge status)
```

## 4. Alur Pelacak

```
User buka tugas → klik "Catat Progress/Waktu"
  → Isi: durasi (menit), catatan aktivitas, tanggal log
  → Tersimpan sebagai satu entri log

Riwayat log terkumpul per tugas & per user
  → Jadi bahan agregasi otomatis untuk Laporan
```

## 5. Alur Generate Laporan

```
User pilih menu Laporan → klik "Buat Laporan Baru"
  → Pilih periode (harian/mingguan/bulanan/custom)
  → Pilih filter (user tertentu/semua, status tertentu)
  → Sistem agregasi data dari Tugas + Pelacak sesuai filter
  → Tampilkan preview laporan di layar

User klik "Export ke PDF"
  → Server render laporan pakai Puppeteer (sesuai PDF_TEMPLATE.md)
  → File PDF tersimpan di RustFS, tercatat di riwayat laporan
  → User bisa download PDF

Laporan lama bisa dibuka ulang dari "Riwayat Laporan" tanpa generate ulang
```

## 6. Alur Manajemen Pengguna (Admin/Dev)

```
Admin buka Manajemen Pengguna
  → Tambah user baru: nama, email, role, password sementara
  → Edit user: ubah role, nonaktifkan akun
  → Reset password user

Catatan: akun Developer tidak muncul di list ini sama sekali
```

## 7. Alur Pengaturan Profil

```
User buka Pengaturan → Profil Saya
  → Upload foto profil → tersimpan di RustFS
  → Edit biodata (nama, telepon, jabatan, bio)
  → Ubah password (password lama, baru, konfirmasi)
```

## 8. Alur Branding & Konfigurasi PDF (Admin/Dev)

```
Admin/Dev buka Pengaturan → Branding & Logo
  → Upload logo → preview → simpan → tersimpan di RustFS
  → Logo otomatis dipakai di Login, Sidebar, Header PDF

Admin/Dev buka Pengaturan → Konfigurasi PDF
  → Atur ukuran kertas, orientasi, header/footer, margin
  → Pengaturan ini dipakai setiap kali generate PDF laporan baru
```

## 9. Alur Panel Developer

```
Dev buka Panel Developer
  → Lihat log sistem (filter by tipe, severity, waktu)
  → Lihat status database
  → Atur konfigurasi Telegram bot (token, chat ID)
  → Sistem otomatis kirim notifikasi Telegram saat:
     - Error kritis terjadi
     - Percobaan login mencurigakan
     - Server restart/down
```
