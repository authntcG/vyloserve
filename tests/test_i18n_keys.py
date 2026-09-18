"""
Regresi i18n: setiap key `backend.*` yang direferensikan di kode Python (baik sebagai
field "message" pada respons API, maupun sebagai argumen self._log()/self._emit_log()/
self._progress()/self._emit_progress()) WAJIB terdaftar di KEDUA file locale frontend.

Kelas bug yang dicegah test ini (lihat docs/known_bugs.md #20):
- Key backend.* dipakai di Python tapi tidak pernah ditambahkan ke translation.json,
  sehingga i18next menampilkan string key mentah ("backend.git.found_external") ke user.
- Typo/penamaan key yang tidak konsisten antara pemanggil dan definisi
  (mis. "backend.database.db_not_found" vs key asli "backend.database.not_found").

Jika test ini gagal, cara memperbaikinya SALAH SATU dari:
1. Tambahkan key yang hilang ke frontend/src/locales/en/translation.json DAN
   frontend/src/locales/id/translation.json (bukan cuma salah satu).
2. Perbaiki typo di kode Python agar cocok dengan key yang sudah ada.
"""
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CORE_DIR = REPO_ROOT / "core"
EN_LOCALE = REPO_ROOT / "frontend" / "src" / "locales" / "en" / "translation.json"
ID_LOCALE = REPO_ROOT / "frontend" / "src" / "locales" / "id" / "translation.json"

# Menangkap literal "backend.xxx.yyy" atau 'backend.xxx.yyy' di mana saja dalam source,
# termasuk sebagai nilai "message", argumen self._log()/self._progress(), dsb.
BACKEND_KEY_PATTERN = re.compile(r'["\'](backend\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)["\']')


def _collect_referenced_keys() -> set[str]:
    keys: set[str] = set()
    for py_file in CORE_DIR.rglob("*.py"):
        text = py_file.read_text(encoding="utf-8")
        for match in BACKEND_KEY_PATTERN.finditer(text):
            keys.add(match.group(1))
    return keys


def _get_nested(node: dict, dotted_path: str):
    for part in dotted_path.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        else:
            return None
    return node


def test_every_referenced_backend_key_exists_in_both_locales():
    referenced_keys = _collect_referenced_keys()
    assert referenced_keys, "Tidak ada key backend.* yang terdeteksi di core/ - pola regex mungkin perlu disesuaikan."

    en = json.loads(EN_LOCALE.read_text(encoding="utf-8"))
    id_ = json.loads(ID_LOCALE.read_text(encoding="utf-8"))

    missing_en = sorted(k for k in referenced_keys if _get_nested(en, k) is None)
    missing_id = sorted(k for k in referenced_keys if _get_nested(id_, k) is None)

    assert not missing_en, (
        "Key backend.* berikut dipakai di core/ tapi TIDAK ADA di "
        f"frontend/src/locales/en/translation.json: {missing_en}"
    )
    assert not missing_id, (
        "Key backend.* berikut dipakai di core/ tapi TIDAK ADA di "
        f"frontend/src/locales/id/translation.json: {missing_id}"
    )
