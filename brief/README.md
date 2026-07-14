# VeReport

Sistem manajemen tugas, jadwal, dan pelacak progres berbasis tim, dengan kemampuan menghasilkan laporan dalam format PDF.

## Tech Stack

- **Frontend**: TanStack Start (Web PWA — responsif mobile, tablet, desktop)
- **Router**: TanStack Router
- **Data Fetching**: TanStack Query
- **Tabel**: TanStack Table
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Autentikasi**: Better-Auth
- **Generate PDF**: Puppeteer
- **Object Storage**: RustFS (S3-compatible) — untuk logo, avatar, file PDF laporan
- **Notifikasi**: Telegram Bot (khusus akun Developer)
- **Package Manager**: PNPM
- **Deployment**: Dockerfile (tanpa docker-compose), via Dokploy

## Struktur Dokumentasi

| File | Isi |
|---|---|
| `AGENT.md` | Aturan wajib untuk AI coding agent |
| `RBAC.md` | Matrix akses per role |
| `MENU.md` | Struktur menu & filter |
| `FLOW.md` | Alur proses aplikasi |
| `SECURITY.md` | Kebijakan keamanan |
| `RELATIONS.md` | Relasi antar entitas/tabel |
| `UI_THEME.md` | Arah desain visual (Soft Minimalist) |
| `API.md` | Daftar server functions |
| `DATABASE.md` | Skema database lengkap |
| `ENV.md` | Daftar environment variable |
| `DEPLOYMENT.md` | Panduan deploy via Dokploy |
| `PDF_TEMPLATE.md` | Spesifikasi desain laporan PDF |

## Role Pengguna

- **Staff** — catat & kelola tugas sendiri
- **Admin** — kelola semua tugas, user, dan laporan
- **Developer** — akses penuh sistem + Panel Developer (log, konfigurasi Telegram, monitoring)
