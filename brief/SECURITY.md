# SECURITY.md

## Autentikasi

- Login pakai email + password (Better-Auth)
- Password di-hash otomatis oleh Better-Auth (bcrypt/argon2)
- Session berbasis token, expired otomatis setelah periode tidak aktif (contoh: 7 hari)
- Logout menghapus session aktif

## Proteksi Login

- Maksimal 5x percobaan gagal login → akun terkunci sementara (15 menit)
- Setiap percobaan gagal dicatat di log (IP, waktu, email yang dicoba)
- Notifikasi ke Telegram Dev kalau ada pola percobaan login mencurigakan (brute force)

## Otorisasi (Role-Based Access)

- Setiap request ke server function divalidasi ulang role-nya di backend, bukan cuma disembunyikan di UI
- Staff tidak bisa akses data user lain meski tahu ID-nya langsung (validasi ownership di query)
- Akun Developer disembunyikan total dari daftar user manapun, termasuk di response API ke Admin

## Proteksi Data

- Environment variable (`.env`) tidak pernah masuk ke Git (gitignored)
- Kredensial database, token Telegram bot, credential RustFS, secret Better-Auth disimpan di `.env`, bukan hardcode
- Semua input divalidasi di server (bukan cuma client-side) — cegah SQL injection, XSS
- File PDF laporan & upload (logo, avatar) disimpan di RustFS dengan akses terbatas (presigned URL / proxy, tidak publik langsung)

## Log & Audit

- Setiap aksi penting (buat/ubah/hapus tugas, ubah role user, generate laporan) tercatat di log aktivitas
- Log mentah hanya bisa dilihat lewat Panel Developer
- Log disimpan minimal 90 hari, lalu rotasi/hapus otomatis

## Komunikasi

- Seluruh traffic wajib HTTPS (ditangani di level Dokploy/reverse proxy)
- Notifikasi Telegram cuma satu arah (server → Dev), tidak menerima command balik dari Telegram

## Backup

- Backup database PostgreSQL terjadwal (harian), disimpan terpisah dari server utama
- File di RustFS idealnya juga punya kebijakan backup/replikasi terpisah

## UI Alert & Konfirmasi

- Dilarang pakai `alert()` / `confirm()` / `prompt()` bawaan browser (rawan disalahgunakan untuk phishing UI dan tidak konsisten secara keamanan visual)
- Semua konfirmasi aksi berisiko tinggi (hapus, ubah role) wajib pakai modal custom yang tidak bisa ditutup dengan klik di luar area modal
