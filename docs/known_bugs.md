# Bugs & Limitasi Diketahui (Known Issues)

Dokumen ini berisi daftar kendala, limitasi arsitektur, dan bug spesifik OS yang *telah ditemukan* (beserta jalan keluarnya). Daftar ini sangat penting untuk mencegah developer atau asisten AI mengulangi kesalahan pencarian (*troubleshooting*) yang sama di masa mendatang.

## 1. Isu Jaringan: PostgreSQL *Timeout* Meskipun Berjalan
**Deskripsi:** Service PostgreSQL versi 18.x seringkali menunjukkan pesan "Timeout waiting for database to start" pada UI, meskipun ketika dites koneksi, databasenya hidup dan memproses query dengan lancar.
**Penyebab (Root Cause):** Konfigurasi *localhost* pada Windows modern (seperti Win 11) untuk keluarga TCP. Fungsi `check_port_in_use()` bawaan awalnya hanya mengecek koneksi jaringan IPV4 (`AF_INET`, `127.0.0.1`), padahal PostgreSQL mengikat (*binding*) listener utamanya ke IPV6 (`::1`).
**Solusi (Fixed):** File `system_utils.py -> check_port_in_use()` telah diperbaiki dengan metode Fallback: jika `127.0.0.1` gagal dikoneksikan, ia akan beralih memeriksa IPv6 `::1`. 

## 2. Isu Hak Akses (UAC) Pada `hosts` Windows
**Deskripsi:** Pembuatan *Virtual Host* otomatis memerlukan modifikasi file rahasia OS `C:\Windows\System32\drivers\etc\hosts`. Ini membutuhkan akses Administrator. Jika Python dijalankan biasa tanpa "Run as Administrator", perubahan ditolak OS.
**Solusi (Fixed):** Pada `project.py`, diterapkan sebuah fungsi fallback `_write_hosts_with_uac`. Aplikasi tidak akan error (crash), namun ia akan membangkitkan popup izin administrator bawaan OS Windows secara parsial (dengan perintah `ctypes.windll.shell32.ShellExecuteW`). Jika diiyakan (return kode > 32), data `hosts` akan disalin.

## 3. Typo *Path* Ekstraksi Apache (`con` vs `conf`)
**Deskripsi:** Instalasi Apache pernah gagal karena tidak menemukan file konfigurasi `/con/httpd.con`.
**Penyebab:** Kesalahan fatal substitusi teks (Find/Replace) pada Regex saat fase refactoring massal, mengubah kata `conf` menjadi `con`.
**Solusi (Fixed):** Semua string referensi telah dikembalikan ke standar direktori Apache yang benar (yakni folder `conf/`). Modul `ssl_manager.py` juga telah diperbaiki (*openssl.cnf*).

## 4. Limitasi `pywebview` dan Komponen React Absolute Z-Index
**Deskripsi:** `pywebview` membatasi fitur-fitur manipulasi *Browser Native* tingkat lanjut. Terkadang menggunakan React *Portal* atau *Z-Index* absolut untuk `Modal` atau `Dropdown` yang terlalu di luar batas layar dapat menyebabkan elemen tersebut terpotong, karena jendela VyloServe bersifat "Frameless Desktop App" (bukan Full Browser).
**Panduan:** Gunakan elemen-elemen UI dari komponen yang sudah disediakan agar tidak menabrak limitasi render EdgeHTML/WebView2.

## 5. Menghindari `git checkout -- <file>` Sembarangan
**Limitasi AI/Developer:** Ketika melakukan refactoring (terutama oleh Agen AI), hindari penggunaan *command terminal* `git checkout -- <file>` untuk melakukan undo jika direktori kerja belum di-*commit*. Itu akan menghapus total pekerjaan yang tidak ter-*track*. **Utamakan** merevisi langsung menggunakan alat baca-tulis file secara manual.
