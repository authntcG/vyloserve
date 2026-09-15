# Pengujian & Pengembangan (Development & Testing)

Panduan teknis untuk para kontributor atau Asisten AI yang hendak melanjutkan pengembangan, melakukan inspeksi kualitas kode, atau merilis aplikasi ini ke publik (Build Production).

## 1. Lingkungan Pengembangan (*Development Environment*)
Aplikasi ini berjalan dengan dua server terpisah (Python dan Vite) yang harus dijalankan bersamaan saat fase pengembangan.

**Set Mode Development:**
Pastikan variabel `IS_PRODUCTION` di dalam `main.py` diatur ke `False`:
```python
# Di dalam main.py
IS_PRODUCTION = False 
```

**Menjalankan Script (Run Script):**
1.  **Frontend (React/Vite):**
    Buka terminal dan jalankan server *development* frontend:
    ```powershell
    cd frontend
    npm run dev
    ```
2.  **Backend (Python):**
    Di terminal terpisah, jalankan entrypoint Python:
    ```powershell
    python main.py
    ```
    *Catatan: Karena `IS_PRODUCTION = False`, PyWebView akan meload `http://localhost:5173` dari Vite, sehingga fitur Hot-Reload (HMR) frontend akan aktif di dalam jendela aplikasi desktop.*

## 2. Pengujian Unit (Unit Testing dengan Pytest)
VyloServe terintegrasi sangat dalam dengan sistem operasi Windows (membongkar registry, mengatur system PATH, membuat subprocess OS). Menjalankan unit test **TIDAK BOLEH** sampai merusak instalasi pengguna! 

**Prinsip Testing:**
- Semua command OS (Subprocess), pengunduhan file (urllib), dan Registry edit (winreg) wajib dilakukan **Patching/Mocking**. 
- Tidak ada file dummy sembarangan yang diturunkan ke disk selain di folder `tmp_path` bawaan pytest.
- Gunakan *Fixture Mock API* (`mock_api` dalam file `tests/conftest.py`) saat menginisiasi Manager agar aplikasi tidak error mencari referensi *Pywebview bridge*.

**Cara Menjalankan Pengujian:**
```powershell
# Menjalankan seluruh test
python -m pytest tests/

# Menjalankan spesifik file dengan log verbosity
python -m pytest tests/test_services/test_apache_parser.py -v
```

## 3. Analisis Kualitas Kode (SonarQube Scan)
Untuk memonitor *Cognitive Complexity*, *Code Smells*, dan *Bugs*, kita menggunakan SonarQube Scanner.
Jalankan perintah ini di root direktori proyek. Pastikan SonarQube berjalan di `http://127.0.0.1:9000`.

**Frontend Sonar Scan:**
```powershell
sonar-scanner.bat -D"sonar.projectKey=vyloserve-fe" -D"sonar.sources=." -D"sonar.host.url=http://127.0.0.1:9000" -D"sonar.token=sqp_65f4d78c54f3eee34fa0f9d56aedefd62d5da905"
```

**Backend Sonar Scan:**
*(Memiliki exclusions agar tidak meng-scan frontend, bin, file cache, dan library yang digenerate).*
```powershell
sonar-scanner.bat -D"sonar.projectKey=vyloserve-be" -D"sonar.sources=." -D"sonar.host.url=http://127.0.0.1:9000" -D"sonar.token=sqp_18072373145f806561605e83343e7f5c7310c886" -D"sonar.exclusions=frontend/**,bin/**,build/**,data/**,dist/**,docs/**,www/**,core/services/__pycache__/**,core/utils/__pycache__/**,core/__pycache__/**" -D"sonar.python.version=3.10" -D"sonar.scm.disabled=true"
```

## 4. Proses Kompilasi Produksi (Build Project)
Untuk membuat aplikasi mandiri (Standalone Windows Executable `.exe`) yang bisa didistribusikan ke pengguna akhir:

> **PERINGATAN (REMEMBER):**
> Anda **WAJIB** mengubah kembali variabel `IS_PRODUCTION = True` pada `main.py` sebelum melakukan *build*. Jika tidak, aplikasi *compiled* akan mencoba mencari Vite server (`localhost:5173`) dan gagal dibuka (blank screen).

**Langkah 1: Build Frontend**
Kompilasi kode React TypeScript menjadi JavaScript statis:
```powershell
cd frontend
npm run build
```
*(File hasil kompilasi akan diletakkan di `frontend/dist`)*.

**Langkah 2: Build Backend (PyInstaller)**
Kembali ke root proyek. Gunakan `--noconsole` agar terminal CMD latar belakang disembunyikan.

*   **Opsi A (OneDir / Standar - Lebih Cepat Dimuat):**
    ```powershell
    pyinstaller --noconsole --add-data "frontend/dist;frontend/dist" --add-data "frontend/src/assets/icons-nobg.ico;frontend/src/assets" main.py
    ```
*   **Opsi B (OneFile - Hanya 1 file `.exe` rapi, namun booting agak lambat):**
    ```powershell
    pyinstaller --noconsole --onefile --icon "frontend\src\assets\icons-nobg.ico" --add-data "frontend/dist;frontend/dist" --add-data "frontend/src/assets/icons-nobg.ico;frontend/src/assets" main.py
    ```

*(Catatan: pastikan fungsi `sys.frozen` telah dikelola dengan baik pada kode `system_utils.py` agar direktori Root tetap terlacak saat dalam bentuk compiled `.exe`).*
