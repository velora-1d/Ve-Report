### Ve-Report (Log Book)

#### Deskripsi
Aplikasi logbook harian tim untuk menyusun laporan, kalender jadwal, dan pelacak progres tanpa beban kerja tambahan.

#### Stack Teknologi
- Frontend: TanStack Start + React 19
- Build Tool: Vite 8
- Server Runtime: Nitro (node-server preset)
- Database: MySQL
- ORM: Drizzle ORM
- Auth: Better Auth
- Styling: Tailwind CSS v4 + shadcn/ui
- State & Data Fetching: TanStack Query, TanStack Router
- Form: React Hook Form + Zod
- Toast: Sonner
- Icons: Lucide React
- Storage: RustFS / S3-compatible

#### Mode Arsitektur
- [x] TanStack Start Fullstack

#### Target Platform
- [x] Web only

#### Multi-tenant
- [ ] Tidak

#### Skala User
- [ ] Kecil (< 100 user)

#### Tim
- [ ] Solo developer

#### Hosting & Infra
- Development: local (vite dev)
- Production: private server dengan Dokploy + Docker
- Production URL: [REDACTED-URL]
- Container: Node.js 22 Alpine, Nitro node-server preset, port 8080

#### Catatan Khusus
- Auth menggunakan Better Auth dengan endpoint `/api/auth/$`.
- `.env` WAJIB memisahkan `DATABASE_URL` dan `BETTER_AUTH_URL` di baris terpisah.
- `BETTER_AUTH_URL` harus di-set ke origin production saat deploy.

#### Progress Terakhir
- Fix: menambahkan `baseURL` dan `basePath` eksplisit di `src/lib/auth.ts`.
- Fix: memperbaiki resolver `baseURL` di `src/lib/auth-client.ts` untuk client & SSR.
- Docs: membuat `.env.example`, `PROJECT.md`, dan `project.json`.
- Pending: perbaikan manual di `.env` karena baris `DATABASE_URL` dan `BETTER_AUTH_URL` menyatu.

#### Last Updated
[REDACTED-DATE_TIME]
