# DEPLOYMENT.md

## Prinsip

- Deploy via Dokploy
- Wajib pakai `Dockerfile` saja — **tidak boleh** pakai `docker-compose.yml`
- Database PostgreSQL & RustFS berjalan sebagai service terpisah di Dokploy, bukan dalam satu container aplikasi

## Langkah Deploy

1. Push kode ke repository Git
2. Dokploy pull & build image dari `Dockerfile`
3. Set environment variables lewat panel Dokploy (sesuai `ENV.md`)
4. Pastikan service PostgreSQL sudah tersedia (terpisah), sambungkan lewat `DATABASE_URL`
5. Pastikan service RustFS sudah tersedia (terpisah), sambungkan lewat kredensial S3
6. Jalankan migration Drizzle setelah container up
7. Domain diarahkan lewat reverse proxy Dokploy (HTTPS otomatis)

## RustFS

- Dijalankan sebagai service terpisah di Dokploy (image resmi RustFS)
- Bucket dibuat sekali di awal setup
- Dipakai untuk menyimpan: logo aplikasi, avatar user, file PDF laporan

## Catatan

- Storage PDF & upload gambar wajib lewat RustFS (S3), bukan disk lokal container — karena container bersifat stateless dan bisa direbuild kapan saja
- Backup database dijadwalkan terpisah dari proses deploy
- Migration database dijalankan manual/terkontrol setelah deploy, bukan otomatis di build step
