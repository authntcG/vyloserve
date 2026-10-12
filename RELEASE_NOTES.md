# VyloServe v0.0.6-alpha

Rilis v0.0.6-alpha menghadirkan fitur pembaca dokumentasi Markdown lokal, perbaikan tata letak panel log agar tidak lagi menutupi konten, penyempurnaan alur pembaruan engine server, serta perbaikan tampilan notifikasi pada Windows.

---

### Fitur Baru: Markdown Documentation Reader

Menu baru di bagian Utilities untuk membaca dokumentasi proyek langsung di dalam aplikasi:
- **Navigasi Explorer:** Buka folder dokumentasi proyek dan jelajahi file serta subfolder lewat tampilan pohon (tree view) di sisi kiri.
- **Dukungan Diagram Mermaid:** Membaca diagram alur, sequence, relasi database, dan arsitektur dengan dukungan pembesaran (zoom) dan geser (pan).
- **Tautan Internal Dokumen:** Tautan antar file markdown di dalam folder dokumentasi langsung membuka dokumen terkait di dalam reader tanpa membuka jendela browser eksternal.
- **Mode Tema Pembaca:** Tersedia opsi tampilan tema Terang atau Gelap khusus pada area dokumen untuk kenyamanan membaca.

---

### Peningkatan Antarmuka & Alur Kerja

- **Panel System Logs Tidak Lagi Menutupi Konten:** Tata letak panel log diubah menjadi panel pemisah (split-pane) di bagian bawah. Mengubah ukuran ketinggian panel kini berjalan instan dan konten di atasnya otomatis menyesuaikan diri tanpa tertimpa.
- **Indikator Pembaruan Engine:** Modul Apache, PHP, Database, Runtimes, Git, dan Tunnel kini menampilkan badge penanda jika ada versi stabil baru yang tersedia, disertai alur backup otomatis sebelum versi diperbarui.
- **Optimalisasi Layar Standar:** Tampilan antarmuka disesuaikan agar tetap responsif dan nyaman digunakan pada layar resolusi standar (seperti 1024x768).

---

### Perbaikan Bug & Performa

- **Ikon Notifikasi Windows:** Memperbaiki masalah hilangnya ikon status (sukses, gagal, peringatan) pada notifikasi desktop Windows di versi rilis aplikasi.
- **Waktu Muat Aplikasi Lebih Cepat:** Paket modul internal dioptimalkan dan dibagi berdasarkan kebutuhan halaman, sehingga penggunaan memori lebih efisien dan aplikasi terbuka lebih cepat.
- **Penyelarasan Bahasa:** Memperbaiki teks antarmuka agar konsisten dan lengkap dalam Bahasa Indonesia maupun Bahasa Inggris.
