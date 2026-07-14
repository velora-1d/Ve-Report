# UI_THEME.md — Arah Desain: Soft Minimalist

## Konsep

Gabungan antara **Neumorphism** (soft, lembut, ada kedalaman halus) dan **Minimalist Flat** (bersih, terang, tidak berantakan). Hasilnya: tampilan modern, tenang, profesional — tidak norak, tidak flat sampai terasa kosong, tidak neumorphism sampai susah dibaca.

Filosofi: **"Tenang tapi hidup."** Setiap elemen terlihat jelas tanpa border tegas berlebihan, tapi tetap ada rasa "kedalaman" halus yang nyaman dipakai lama — cocok untuk aplikasi kerja harian.

## Responsivitas

Wajib responsif penuh di tiga breakpoint:
- **Mobile**: grid wajib minimal 2 kolom (tidak boleh 1 kolom polos, kecuali form/detail page)
- **Tablet**: grid menyesuaikan (3-4 kolom untuk card/list)
- **Desktop**: grid penuh dengan sidebar tetap terlihat

## Suasana yang Ingin Dicapai

- Bersih dan lapang — banyak whitespace, tidak sesak
- Elemen terasa "mengambang" lembut, bukan menempel rata
- Warna dominan netral (putih/abu sangat muda) dengan satu warna aksen konsisten
- Shadow sangat halus — bukan shadow tajam/keras
- Tipografi tegas tapi tidak kaku
- Tidak ada gradient ramai, tidak ada warna neon, tidak ada dekorasi berlebihan

## Prinsip untuk AI Agent Saat Generate UI

1. Kesederhanaan dulu, dekorasi belakangan — kalau ragu nambah elemen visual, jangan ditambahkan.
2. Kedalaman itu bisikan, bukan teriakan — efek neumorphism harus halus, hampir tidak sadar ada shadow-nya.
3. Satu warna aksen konsisten dipakai di seluruh aplikasi (tombol utama, status aktif, highlight).
4. Card/panel terasa seperti permukaan yang sama, bukan kotak-kotak terpisah dengan border tegas.
5. Prioritas keterbacaan di atas estetika.
6. Konsisten di semua halaman — dashboard, tugas, jadwal, laporan, panel developer harus satu keluarga desain.
7. Versi PDF laporan tetap ikut nuansa ini tapi disederhanakan (lihat `PDF_TEMPLATE.md`).
8. Dark mode opsional untuk fase belakangan; versi terang (light) adalah acuan utama.

## Yang Harus Dihindari

- Shadow tajam/keras
- Gradient ramai atau efek glow
- Gaya visual berbeda-beda antar komponen
- Border garis tegas berlebihan
- Icon dekoratif yang tidak fungsional

## Komponen Alert & Konfirmasi (Custom, Wajib)

Dilarang pakai `alert()`, `confirm()`, `prompt()` bawaan browser — semua notifikasi dan konfirmasi wajib pakai komponen custom mengikuti gaya Soft Minimalist di atas.

**Toast/Notifikasi** (info singkat: berhasil, error, peringatan)
- Muncul di pojok layar (posisi konsisten di seluruh aplikasi)
- Auto-hilang setelah beberapa detik, bisa di-dismiss manual
- Varian: Sukses (aksen hijau lembut), Error (aksen merah lembut), Peringatan (aksen kuning lembut), Info (aksen netral)

**Modal Konfirmasi** (aksi penting: hapus, keluar, ubah role)
- Muncul di tengah layar dengan overlay blur/gelap transparan
- Judul jelas + deskripsi konsekuensi aksi
- Dua tombol: Batal (netral) dan Konfirmasi (warna sesuai tingkat risiko)
- Untuk aksi destruktif/berisiko tinggi, tidak bisa ditutup dengan klik di luar modal — wajib klik salah satu tombol
