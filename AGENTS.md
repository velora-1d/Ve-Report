# Project Agents

This document contains guidelines for autonomous agents working on this project.

## Development & Deployment Guidelines

- This project is deployed on a private server using Dokploy.
- Any database schema changes must be handled through Drizzle migrations.
- Keep the codebase clean, performant, and fully type-safe.

---

## Global Setup Rules (gemini.md & Mandatory Components)

Aturan di [gemini.md](file:///home/pak-hakim/Hakim/Project/Ve-Report/gemini.md) berlaku secara global dan mengikat untuk semua tool pengembangan: **opencode**, **codex**, **agy (antigravity cli)**, **antigravity ide**, dan **claude code**.

Setiap tool wajib memastikan 9 komponen berikut terkonfirmasi aktif dan digunakan:

1. **ponytail**: Terapkan YAGNI, rampingkan kode, hilangkan boilerplate. Tulis komentar `// ponytail: <alasan/simplifikasi>` di setiap kode yang dirapikan.
2. **codegraph**: Pahami struktur relasi simbol dan relasi modul (seperti impor skema Drizzle dan rute TanStack) sebelum memodifikasi kode.
3. **serena**: Jaga ketenangan komunikasi, komunikasikan fakta secara rasional, hindari sycophancy.
4. **caveman**: Commit git lokal yang sering, log padat. Jangan git push tanpa izin eksplisit dari User.
5. **contextmode**: Optimalkan context window LLM. Hindari membaca seluruh isi file besar tanpa slicing line range (`StartLine`, `EndLine`).
6. **headroom**: Kelola sumber daya memori dan hindari loop pencarian melingkar.
7. **rtk**: Selalu awali perintah shell dengan prefix `rtk` (misalnya: `rtk git status`) untuk mengompres output terminal.
8. **skills**: Gunakan folder skill bawaan sistem (seperti `ponytail/SKILL.md`) sebelum melakukan pengerjaan.
9. **mcp**: Gunakan Model Context Protocol (MCP) untuk terhubung secara terstruktur ke database dan filesystem.
