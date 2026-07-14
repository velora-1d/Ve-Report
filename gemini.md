# GEMINI.md — Aturan Global & Konfigurasi Agen

Dokumen ini berlaku secara global dan mengikat untuk semua tool pengembangan kecerdasan buatan (AI coding tools) yang bekerja pada repositori ini, yaitu:
- **opencode**
- **codex**
- **agy (antigravity cli)**
- **antigravity ide**
- **claude code**

Setiap tool wajib memastikan bahwa 9 komponen berikut terkonfirmasi aktif, dikonfigurasi dengan benar, dan diimplementasikan dalam setiap tugas pemrograman.

---

## KOMPONEN WAJIB & PETUNJUK AKTIVASI

### 1. ponytail
*   **Status**: Wajib Aktif.
*   **Tujuan**: Perampingan kode berdasarkan prinsip YAGNI (You Aren't Gonna Need It). Menghindari boilerplate berlebih, penulisan kode yang tidak perlu, dan mengoptimalkan penggunaan token.
*   **Aturan Implementasi**:
    *   Setiap kali melakukan refactoring atau penyederhanaan kode, tulis komentar penjelas dengan format:
        `// ponytail: <alasan penyederhanaan / optimasi>`
    *   Hapus modul atau dependensi yang tidak terpakai dari file target.

### 2. codegraph
*   **Status**: Wajib Aktif.
*   **Tujuan**: Pemetaan relasi kode (symbol mapping) secara menyeluruh. Agen wajib memahami diagram dependensi sebelum mengubah struktur.
*   **Aturan Implementasi**:
    *   Petakan impor, relasi database, ekspor modul, dan relasi antar komponen (seperti pemetaan skema database lokal Drizzle ke frontend client) sebelum melakukan perubahan besar.

### 3. serena
*   **Status**: Wajib Aktif.
*   **Tujuan**: Komunikasi yang tenang, rasional, dan anti-sycophancy. Menghindari kesepakatan secara buta dengan kesalahan user dan selalu mengutamakan kebenaran kode serta kebersihan arsitektur.
*   **Aturan Implementasi**:
    *   Jangan setuju secara membabi buta jika instruksi user melanggar performa atau best-practice arsitektur. Diskusikan alternatif terbaik secara sopan dan ringkas.

### 4. caveman
*   **Status**: Wajib Aktif.
*   **Tujuan**: Komit Git lokal yang bersih dan terdokumentasi dengan baik, log yang padat, dan pencegahan kehilangan data.
*   **Aturan Implementasi**:
    *   Setiap langkah pengerjaan yang stabil harus langsung di-commit ke repositori lokal.
    *   Dilarang keras melakukan `git push` ke remote tanpa persetujuan eksplisit dari User (karena memicu auto-build Dokploy yang lambat).

### 5. contextmode
*   **Status**: Wajib Aktif.
*   **Tujuan**: Optimasi context window LLM. Menjaga riwayat percakapan tetap efisien dan hemat token.
*   **Aturan Implementasi**:
    *   Gunakan parameter pemotongan / limit pada tool baca file (`view_file` menggunakan `StartLine` dan `EndLine`) agar tidak menumpuk seluruh isi file besar sekaligus jika tidak diperlukan.

### 6. headroom
*   **Status**: Wajib Aktif.
*   **Tujuan**: Manajemen sumber daya memori dan pelacakan eksekusi tugas bertahap agar tidak terjebak dalam infinite loop atau pencarian melingkar.
*   **Aturan Implementasi**:
    *   Lakukan pengecekan status tugas berkala secara terstruktur, jangan biarkan background task berjalan tanpa batas jika terjadi kendala/error.

### 7. rtk (Rust Token Killer)
*   **Status**: Wajib Aktif.
*   **Tujuan**: Penggunaan CLI proxy hemat token untuk eksekusi perintah terminal.
*   **Aturan Implementasi**:
    *   Semua perintah shell wajib diawali dengan prefix `rtk` (contoh: `rtk git status`, `rtk run npx tsc --noEmit`).

### 8. skills
*   **Status**: Wajib Aktif.
*   **Tujuan**: Pemanfaatan direktori skill bawaan sistem (seperti `ponytail`, `systematic-debugging`, dsb.) untuk membimbing agen.
*   **Aturan Implementasi**:
    *   Baca file instruksi `SKILL.md` yang relevan sebelum memulai tugas khusus yang memiliki skill di list environment.

### 9. mcp (Model Context Protocol)
*   **Status**: Wajib Aktif.
*   **Tujuan**: Penggunaan MCP Server resmi yang dikonfigurasi untuk database dan filesystem untuk meningkatkan keakuratan dan performa pencarian.
*   **Aturan Implementasi**:
    *   Gunakan API/tool bawaan MCP jika tersedia untuk interaksi terstruktur dibanding menulis command/skrip ad-hoc.
