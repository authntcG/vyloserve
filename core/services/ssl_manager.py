import os
import subprocess
import ctypes
import sys

class SslManager:
    def __init__(self, api_ref):
        self.api = api_ref
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.ssl_dir = os.path.join(root_dir, 'data', 'ssl')
        
        # Buat folder penampungan sertifikat jika belum ada
        os.makedirs(self.ssl_dir, exist_ok=True)

        # Identitas Master Root CA VyloServe
        self.ca_key = os.path.join(self.ssl_dir, 'VyloServeRootCA.key')
        self.ca_crt = os.path.join(self.ssl_dir, 'VyloServeRootCA.crt')

    def _get_openssl_paths(self):
        """Memanfaatkan openssl.exe bawaan Apache agar tidak perlu instalasi tambahan"""
        status = self.api.apache.get_status()
        if not status.get("installed"):
            raise Exception("Apache belum terinstal. OpenSSL tidak ditemukan.")
        
        apache_path = status["path"]
        exe = os.path.join(apache_path, 'bin', 'openssl.exe')
        cnf = os.path.join(apache_path, 'conf', 'openssl.cnf')
        return exe, cnf

    def setup_root_ca(self):
        """Membuat Root CA dan menanamkannya ke Windows Trust Store"""
        if os.path.exists(self.ca_key) and os.path.exists(self.ca_crt):
            return True # Root CA sudah terinstal sebelumnya

        openssl_exe, openssl_cnf = self._get_openssl_paths()
        self.api.emit_log("Membuat VyloServe Root CA (Otoritas Sertifikat Lokal)...", "info")

        CREATE_NO_WINDOW = 0x08000000

        try:
            # 1. Generate Private Key untuk Root CA
            subprocess.run([openssl_exe, 'genrsa', '-out', self.ca_key, '2048'], creationflags=CREATE_NO_WINDOW)
            
            # 2. Generate Certificate Root CA (Valid 10 Tahun)
            subprocess.run([
                openssl_exe, 'req', '-x509', '-new', '-nodes', '-key', self.ca_key, 
                '-sha256', '-days', '3650', '-out', self.ca_crt, 
                '-subj', '/CN=VyloServe Local Root CA/O=VyloServe/C=ID',
                '-config', openssl_cnf
            ], creationflags=CREATE_NO_WINDOW)

            self.api.emit_log("Root CA dibuat. Meminta akses Administrator (UAC) untuk menanamkannya ke Windows...", "warn")
            
            # 3. Instal ke Windows "Trusted Root Certification Authorities"
            cmd = f'certutil -addstore -f "Root" "{self.ca_crt}"'
            result = ctypes.windll.shell32.ShellExecuteW(None, "runas", "cmd.exe", f"/c {cmd}", None, 0)
            
            # Windows API ShellExecuteW mengembalikan nilai > 32 jika berhasil
            if result > 32:
                self.api.emit_log("Root CA VyloServe berhasil dipercaya oleh OS Windows!", "success")
                return True
            else:
                self.api.emit_log("Gagal menginstal Root CA: Akses Administrator ditolak.", "error")
                return False
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan saat setup CA: {str(e)}", "error")
            return False

    def generate_domain_cert(self, domain):
        """Mencetak sertifikat SSL (HTTPS) khusus untuk domain yang diminta"""
        self.setup_root_ca() # Pastikan CA sudah ada sebelum mencetak sertifikat anak

        domain_key = os.path.join(self.ssl_dir, f"{domain}.key")
        domain_csr = os.path.join(self.ssl_dir, f"{domain}.csr")
        domain_crt = os.path.join(self.ssl_dir, f"{domain}.crt")
        domain_ext = os.path.join(self.ssl_dir, f"{domain}.ext")

        if os.path.exists(domain_crt) and os.path.exists(domain_key):
            return domain_crt, domain_key # Sertifikat sudah ada

        openssl_exe, openssl_cnf = self._get_openssl_paths()
        CREATE_NO_WINDOW = 0x08000000

        try:
            # 1. Private Key Domain
            subprocess.run([openssl_exe, 'genrsa', '-out', domain_key, '2048'], creationflags=CREATE_NO_WINDOW)
            
            # 2. Certificate Signing Request (CSR)
            subprocess.run([
                openssl_exe, 'req', '-new', '-key', domain_key, '-out', domain_csr, 
                '-subj', f'/CN={domain}/O=VyloServe Dev/C=ID',
                '-config', openssl_cnf
            ], creationflags=CREATE_NO_WINDOW)

            # 3. File Ekstensi (SAN) -> WAJIB agar Chrome & Edge memunculkan Gembok Hijau
            with open(domain_ext, 'w') as f:
                f.write("authorityKeyIdentifier=keyid,issuer\n")
                f.write("basicConstraints=CA:FALSE\n")
                f.write("keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment\n")
                f.write("subjectAltName = @alt_names\n")
                f.write("[alt_names]\n")
                f.write(f"DNS.1 = {domain}\n")
                f.write(f"DNS.2 = *.{domain}\n")

            # 4. Tanda Tangani Sertifikat Menggunakan VyloServe Root CA
            subprocess.run([
                openssl_exe, 'x509', '-req', '-in', domain_csr, '-CA', self.ca_crt, 
                '-CAkey', self.ca_key, '-CAcreateserial', '-out', domain_crt, 
                '-days', '3650', '-sha256', '-extfile', domain_ext
            ], creationflags=CREATE_NO_WINDOW)

            # Bersihkan file sampah (CSR & EXT)
            if os.path.exists(domain_csr): os.remove(domain_csr)
            if os.path.exists(domain_ext): os.remove(domain_ext)
            
            self.api.emit_log(f"Sertifikat SSL (HTTPS) untuk {domain} berhasil dibuat.", "success")
            return domain_crt, domain_key
            
        except Exception as e:
            self.api.emit_log(f"Gagal mencetak sertifikat SSL {domain}: {str(e)}", "error")
            raise e