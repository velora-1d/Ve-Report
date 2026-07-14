# RELATIONS.md — Relasi Antar Entitas

## Diagram Relasi

```
┌─────────────┐
│   Pengguna   │ (users)
└──────┬───────┘
       │
       ├── membuat ──────────────┐
       │                         ▼
       │                  ┌─────────────┐
       ├── ditugaskan ke ─│    Tugas     │ (tasks)
       │                  └──────┬───────┘
       │                         │
       │                         ├── punya banyak ──► Jadwal (schedules)
       │                         │                     [opsional, boleh kosong]
       │                         │
       │                         └── punya banyak ──► Log Pelacak (tracker_logs)
       │
       ├── punya banyak ──► Jadwal (schedules)
       │                     [boleh berdiri sendiri, tanpa tugas]
       │
       ├── punya banyak ──► Log Pelacak (tracker_logs)
       │
       ├── generate ──────► Laporan (reports)
       │                     [agregasi dari Tugas + Log Pelacak]
       │
       └── punya ─────────► Profil (biodata + avatar, melekat di tabel users)
```

## Penjelasan Relasi

**Pengguna → Tugas**
- Satu pengguna bisa jadi pembuat banyak tugas (`createdBy`)
- Satu pengguna bisa jadi penerima banyak tugas (`assignedTo`)
- Satu tugas hanya punya satu penerima (tidak multi-assignee di versi awal)

**Tugas → Jadwal**
- Satu tugas bisa punya banyak jadwal (dikerjakan bertahap dalam beberapa sesi waktu)
- Jadwal tidak wajib terhubung ke tugas (reminder pribadi berdiri sendiri)

**Tugas → Log Pelacak**
- Satu tugas bisa punya banyak log pelacak
- Log pelacak wajib terhubung ke satu tugas

**Pengguna → Log Pelacak**
- Satu pengguna bisa punya banyak log pelacak (riwayat semua progress yang pernah dicatat)

**Log Pelacak + Tugas → Laporan**
- Laporan tidak menyimpan data mentah sendiri — hasil agregasi/query dari Tugas dan Log Pelacak berdasarkan filter
- Tabel `reports` hanya menyimpan metadata: siapa generate, periode apa, lokasi file PDF di RustFS

**Pengguna → Panel Developer (Log Sistem)**
- Log sistem terpisah total dari data operasional — log teknis (error, request, keamanan), hanya dilihat akun Developer

**Pengguna → Branding/Konfigurasi PDF**
- Bukan relasi per-user, tapi pengaturan global aplikasi (satu baris konfigurasi), hanya bisa diubah Admin/Developer
