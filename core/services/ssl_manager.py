import os
import ctypes
from typing import Tuple

from core.utils.system_utils import get_project_root, run_silent_command

class SslManager:
    """Manager untuk menciptakan Certificate Authority (CA) dan menandatangani sertifikat HTTPS"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.ssl_dir = os.path.join(get_project_root(), 'data', 'ssl')
        os.makedirs(self.ssl_dir, exist_ok=True)

        self.ca_key = os.path.join(self.ssl_dir, 'VyloServeRootCA.key')
        self.ca_crt = os.path.join(self.ssl_dir, 'VyloServeRootCA.crt')

    def _get_openssl_paths(self) -> Tuple[str, str]:
        status = self.api.apache.get_status()
        if not status.get("installed"):
            raise Exception("Apache belum terinstal. OpenSSL tidak ditemukan.")
        
        apache_path = status["path"]
        return os.path.join(apache_path, 'bin', 'openssl.exe'), os.path.join(apache_path, 'conf', 'openssl.cnf')

    def setup_root_ca(self) -> bool:
        if os.path.exists(self.ca_key) and os.path.exists(self.ca_crt): return True 

        openssl_exe, openssl_cnf = self._get_openssl_paths()
        self.api.emit_log("Membuat VyloServe Root CA (Otoritas Sertifikat Lokal)...", "info")

        try:
            run_silent_command([openssl_exe, 'genrsa', '-out', self.ca_key, '2048'])
            run_silent_command([
                openssl_exe, 'req', '-x509', '-new', '-nodes', '-key', self.ca_key, 
                '-sha256', '-days', '3650', '-out', self.ca_crt, 
                '-subj', '/CN=VyloServe Local Root CA/O=VyloServe/C=ID',
                '-config', openssl_cnf
            ])

            self.api.emit_log("Meminta akses Administrator (UAC) untuk menanamkan Root CA...", "warn")
            
            cmd = f'certutil -addstore -f "Root" "{self.ca_crt}"'
            result = ctypes.windll.shell32.ShellExecuteW(None, "runas", "cmd.exe", f"/c {cmd}", None, 0)
            
            if result > 32:
                self.api.emit_log("Root CA VyloServe berhasil dipercaya oleh OS Windows!", "success")
                return True
            else:
                self.api.emit_log("Gagal menginstal Root CA: Akses Administrator ditolak.", "error")
                return False
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan saat setup CA: {str(e)}", "error")
            return False

    def generate_domain_cert(self, domain: str) -> Tuple[str, str]:
        self.setup_root_ca()

        domain_key = os.path.join(self.ssl_dir, f"{domain}.key")
        domain_csr = os.path.join(self.ssl_dir, f"{domain}.csr")
        domain_crt = os.path.join(self.ssl_dir, f"{domain}.crt")
        domain_ext = os.path.join(self.ssl_dir, f"{domain}.ext")

        if os.path.exists(domain_crt) and os.path.exists(domain_key):
            return domain_crt, domain_key 

        openssl_exe, openssl_cnf = self._get_openssl_paths()

        try:
            run_silent_command([openssl_exe, 'genrsa', '-out', domain_key, '2048'])
            run_silent_command([
                openssl_exe, 'req', '-new', '-key', domain_key, '-out', domain_csr, 
                '-subj', f'/CN={domain}/O=VyloServe Dev/C=ID',
                '-config', openssl_cnf
            ])

            with open(domain_ext, 'w') as f:
                f.write(f"authorityKeyIdentifier=keyid,issuer\nbasicConstraints=CA:FALSE\nkeyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment\nsubjectAltName = @alt_names\n[alt_names]\nDNS.1 = {domain}\nDNS.2 = *.{domain}\n")

            run_silent_command([
                openssl_exe, 'x509', '-req', '-in', domain_csr, '-CA', self.ca_crt, 
                '-CAkey', self.ca_key, '-CAcreateserial', '-out', domain_crt, 
                '-days', '3650', '-sha256', '-extfile', domain_ext
            ])

            if os.path.exists(domain_csr): os.remove(domain_csr)
            if os.path.exists(domain_ext): os.remove(domain_ext)
            
            self.api.emit_log(f"Sertifikat SSL (HTTPS) untuk {domain} berhasil dibuat.", "success")
            return domain_crt, domain_key
            
        except Exception as e:
            self.api.emit_log(f"Gagal mencetak sertifikat SSL {domain}: {str(e)}", "error")
            raise e

    def delete_domain_cert(self, domain: str):
        """Menghapus file sertifikat SSL jika virtual host dihapus"""
        for ext in ['.key', '.csr', '.crt', '.ext']:
            file_path = os.path.join(self.ssl_dir, f"{domain}{ext}")
            if os.path.exists(file_path):
                try: os.remove(file_path)
                except: pass