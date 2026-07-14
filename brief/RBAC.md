# RBAC.md — Role Access Matrix

Seluruh UI aplikasi berbahasa Indonesia (label menu, tombol, pesan sistem, laporan PDF).

## Role

- **Staff** — pengguna biasa, kelola tugas & jadwal sendiri
- **Admin** — kelola semua tugas, user, dan laporan
- **Developer** — akses penuh sistem + Panel Developer (akun tersembunyi dari daftar user)

## Matrix Akses per Menu

| Menu                               | Staff                     | Admin                        | Developer       |
| ---------------------------------- | ------------------------- | ---------------------------- | --------------- |
| Login                              | ✅                        | ✅                           | ✅              |
| Dasbor                             | ✅ (data sendiri)         | ✅ (semua data)              | ✅ (semua data) |
| Tugas & Jadwal                     | ✅ (tugas/jadwal sendiri) | ✅ (semua, bisa assign)      | ✅ (semua)      |
| Pelacak                            | ✅ (log sendiri)          | ✅ (semua log)               | ✅ (semua)      |
| Laporan                            | ✅ (laporan diri sendiri) | ✅ (semua/per user)          | ✅ (semua)      |
| Manajemen Pengguna                 | ❌                        | ✅                           | ✅              |
| Pengaturan (Profil, Branding, PDF) | ✅ (profil sendiri)       | ✅ (profil + branding + PDF) | ✅ (semua)      |
| Panel Developer                    | ❌                        | ❌                           | ✅              |

## Aturan Tambahan

- Staff tidak bisa melihat/mengedit tugas milik user lain.
- Staff tidak bisa assign tugas ke orang lain (hanya menerima assignment).
- Admin tidak bisa akses Panel Developer meskipun akses lain penuh.
- Akun Developer tidak muncul di daftar Manajemen Pengguna (tersembunyi dari list, tidak bisa dihapus/diubah oleh Admin).
- Semua aksi hapus (tugas, jadwal, user) wajib konfirmasi modal custom sebelum eksekusi.
- Login gagal berulang (5x) → akun terkunci sementara (lihat `SECURITY.md`).
- Pengaturan Branding & Konfigurasi PDF hanya bisa diakses Admin/Developer.
