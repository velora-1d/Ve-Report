# AGENT.md — Aturan untuk AI Coding Agent

Proyek: **VeReport**

## Bahasa

- Semua teks UI, pesan error, label, komentar penting dalam Bahasa Indonesia.
- Nama variabel/fungsi/kode tetap Bahasa Inggris (standar coding).

## Referensi Wajib Dibaca Sebelum Coding

Baca dokumen berikut sebelum generate kode apapun:
`RBAC.md`, `MENU.md`, `FLOW.md`, `SECURITY.md`, `RELATIONS.md`, `UI_THEME.md`, `API.md`, `DATABASE.md`, `ENV.md`, `DEPLOYMENT.md`, `PDF_TEMPLATE.md`

## Aturan Teknis

- Jangan pakai `alert()` / `confirm()` / `prompt()` bawaan browser — wajib komponen custom (lihat `UI_THEME.md`, bagian Komponen Alert & Konfirmasi).
- Setiap server function wajib validasi role di backend, jangan percaya UI/client saja.
- Jangan hardcode credential — selalu lewat `.env` (lihat `ENV.md`).
- Ikuti struktur folder di `ARCHITECTURE.md` / dokumentasi struktur proyek, jangan bikin pola baru tanpa alasan jelas.
- Ikuti skema database di `DATABASE.md` sebagai sumber kebenaran — jangan ubah struktur tabel tanpa didiskusikan dulu.
- Ikuti template PDF di `PDF_TEMPLATE.md` persis, termasuk struktur header/footer dan prinsip desain hitam-putih ramah.

## Instruksi Skills & MCP

- Sebelum membuat file dokumen apapun (Word, PDF, Excel, Slide), wajib cek dan gunakan Skill yang tersedia di sistem sesuai jenis filenya — jangan generate manual dari nol kalau ada Skill resminya.
- Kalau tugas melibatkan pembuatan/pengecekan PDF (template laporan, PDF form), gunakan Skill PDF yang tersedia di sistem, bukan pendekatan ad-hoc.
- Kalau tugas butuh integrasi ke layanan eksternal (database, file storage, API pihak ketiga) dan tersedia MCP/connector yang sesuai di sistem, gunakan itu dulu sebelum menulis kode integrasi custom dari nol.
- Jangan asumsikan Skill atau MCP tersedia — cek dulu daftar yang ada di environment sebelum dipakai atau direferensikan di kode/dokumentasi.
- Kalau tidak ada Skill/MCP yang cocok untuk suatu kebutuhan, baru boleh implementasi manual/custom.

## Aturan Perilaku Agent

- Jangan generate fitur di luar scope dokumen tanpa ditanya dulu.
- Kalau ada ambiguitas, tanya dulu — jangan asumsi sendiri.
- Konsisten dengan penamaan yang sudah ada di dokumen (jangan ganti-ganti istilah antar file/halaman).
- Jangan menghapus atau mengganti keputusan arsitektur yang sudah ditetapkan di dokumen tanpa konfirmasi eksplisit.
