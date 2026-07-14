# API.md — Server Functions (TanStack Start)

Tidak memakai REST endpoint tradisional terpisah — memakai server functions TanStack Start yang dipanggil langsung dari client, tetapi tetap divalidasi role di server. Pesan response konsisten dan dalam Bahasa Indonesia.

## Auth
- `login(email, password)` → session/token
- `logout()` → hapus session
- `getSession()` → data user aktif + role

## Tugas
- `getTugas(filter)` → list tugas (otomatis ter-filter sesuai role)
- `getTugasById(id)` → detail satu tugas + histori status
- `createTugas(data)` → buat tugas baru [Admin/Dev only]
- `updateTugasStatus(id, status, catatan)` → ubah status
- `assignTugas(id, userId)` → assign ulang [Admin/Dev only]
- `deleteTugas(id)` → hapus tugas [Admin/Dev only, wajib konfirmasi]

## Jadwal
- `getJadwal(filter)` → list jadwal (rentang tanggal, tampilan)
- `createJadwal(data)` → buat jadwal baru (opsional link ke tugas)
- `updateJadwal(id, data)` → ubah jadwal
- `deleteJadwal(id)` → hapus jadwal

## Pelacak
- `getTrackerLogs(filter)` → list log (per tugas/user/tanggal)
- `createTrackerLog(data)` → catat progress/waktu baru
- `getTrackerSummary(filter)` → agregasi total waktu per tugas/user

## Laporan
- `generateLaporan(filter)` → agregasi data, return preview
- `exportLaporanPdf(reportId)` → trigger render Puppeteer, simpan ke RustFS, return URL
- `getRiwayatLaporan()` → list laporan yang pernah dibuat
- `getLaporanById(id)` → buka laporan lama

## Manajemen Pengguna [Admin/Dev only]
- `getUsers()` → list user (akun Developer disembunyikan dari hasil)
- `createUser(data)` → tambah user baru
- `updateUser(id, data)` → edit role/status
- `resetPassword(id)` → generate password sementara

## Profil
- `getProfile()` → data profil sendiri
- `updateProfile(data)` → update biodata (nama, telepon, jabatan, bio)
- `uploadAvatar(file)` → upload ke RustFS, update `avatarUrl`
- `changePassword(oldPassword, newPassword)`

## Branding & Konfigurasi PDF [Admin/Dev only]
- `getBranding()` → ambil logo aktif
- `uploadLogo(file)` → upload ke RustFS, set sebagai logo aktif
- `getPdfConfig()` → ambil pengaturan PDF aktif
- `updatePdfConfig(data)` → ukuran kertas, orientasi, header/footer, margin

## Panel Developer [Dev only]
- `getSystemLogs(filter)` → log mentah (tipe, severity, waktu)
- `getDbStatus()` → status koneksi & ukuran database
- `updateTelegramConfig(token, chatId)` → atur bot notifikasi
- `testTelegramNotif()` → kirim pesan uji coba

## Aturan Umum
- Semua fungsi wajib cek session aktif dulu sebelum eksekusi
- Semua fungsi yang butuh role tertentu wajib validasi ulang di server
- Semua pesan error dalam Bahasa Indonesia, contoh: `"Anda tidak memiliki akses untuk aksi ini"`
