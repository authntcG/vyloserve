import os
import time
import uuid
import hashlib
import binascii
from typing import Dict, Any, List

try:
    import bcrypt
except ImportError:
    bcrypt = None

CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
MSG_INVALID_INPUT = "backend.crypto.invalid_input"


class CryptoTools:
    """
    Service for generating cryptographic hashes, Bcrypt passwords,
    UUIDs (v4 & v7), ULIDs, and text checksums.
    """

    def __init__(self, api=None):
        self.api = api

    def _log(self, msg: str, level: str = "info", args: dict = None) -> None:
        if self.api and hasattr(self.api, "emit_log"):
            self.api.emit_log(msg, level, args or {})

    def generate_bcrypt_hash(self, plain_text: str, rounds: int = 10, prefix: str = "2y") -> Dict[str, Any]:
        """
        Generates a Bcrypt hash with configurable rounds (4-14) and prefix ($2y$ or $2b$).
        """
        if bcrypt is None:
            return {"status": "error", "message": "backend.crypto.bcrypt_not_available"}

        if not isinstance(plain_text, str):
            return {"status": "error", "message": MSG_INVALID_INPUT}

        try:
            # Clamp rounds between 4 and 14 for performance and security
            valid_rounds = max(4, min(14, int(rounds)))
            clean_prefix = "2y" if prefix.lower() in ("2y", "$2y$") else "2b"

            salt = bcrypt.gensalt(rounds=valid_rounds, prefix=b"2b")
            hashed = bcrypt.hashpw(plain_text.encode("utf-8"), salt).decode("utf-8")

            if clean_prefix == "2y" and hashed.startswith("$2b$"):
                hashed = "$2y$" + hashed[4:]

            return {
                "status": "success",
                "hash": hashed,
                "rounds": valid_rounds,
                "prefix": clean_prefix,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": "backend.crypto.hash_error",
                "args": {"e": str(e)},
            }

    def verify_bcrypt_hash(self, plain_text: str, hashed: str) -> Dict[str, Any]:
        """
        Verifies plain text password against a Bcrypt hash string ($2a$, $2b$, or $2y$).
        """
        if bcrypt is None:
            return {"status": "error", "message": "backend.crypto.bcrypt_not_available"}

        if not isinstance(plain_text, str) or not isinstance(hashed, str) or not hashed.strip():
            return {"status": "error", "message": MSG_INVALID_INPUT}

        try:
            # Normalize 2y/2a hash to 2b for python-bcrypt compatibility if needed
            clean_hash = hashed.strip()
            hash_bytes = clean_hash.encode("utf-8")

            is_match = bcrypt.checkpw(plain_text.encode("utf-8"), hash_bytes)

            return {
                "status": "success",
                "is_match": is_match,
                "message": "backend.crypto.verify_match" if is_match else "backend.crypto.verify_mismatch",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": "backend.crypto.verify_error",
                "args": {"e": str(e)},
            }

    def generate_ids(self, kind: str = "uuid4", count: int = 1) -> Dict[str, Any]:
        """
        Bulk generates unique identifiers: uuid4, uuid7, or ulid.
        Count is clamped between 1 and 50.
        """
        valid_count = max(1, min(50, int(count)))
        kind_lower = (kind or "uuid4").lower()
        results: List[str] = []

        try:
            for _ in range(valid_count):
                if kind_lower == "uuid7":
                    results.append(self._generate_uuid7())
                elif kind_lower == "ulid":
                    results.append(self._generate_ulid())
                else:
                    results.append(str(uuid.uuid4()))

            return {
                "status": "success",
                "kind": kind_lower,
                "count": len(results),
                "ids": results,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": "backend.crypto.id_error",
                "args": {"e": str(e)},
            }

    def generate_text_hashes(self, plain_text: str) -> Dict[str, Any]:
        """
        Calculates all standard cryptographic checksums for a given string.
        """
        if not isinstance(plain_text, str):
            return {"status": "error", "message": MSG_INVALID_INPUT}

        try:
            encoded = plain_text.encode("utf-8")
            crc = binascii.crc32(encoded) & 0xFFFFFFFF

            return {
                "status": "success",
                "hashes": {
                    "md5": hashlib.md5(encoded).hexdigest(),  # NOSONAR python:S4790
                    "sha1": hashlib.sha1(encoded).hexdigest(),  # NOSONAR python:S4790
                    "sha224": hashlib.sha224(encoded).hexdigest(),  # NOSONAR python:S4790
                    "sha256": hashlib.sha256(encoded).hexdigest(),
                    "sha384": hashlib.sha384(encoded).hexdigest(),
                    "sha512": hashlib.sha512(encoded).hexdigest(),
                    "crc32": f"{crc:08x}",
                },
            }
        except Exception as e:
            return {
                "status": "error",
                "message": "backend.crypto.hash_error",
                "args": {"e": str(e)},
            }

    @staticmethod
    def _generate_uuid7() -> str:
        """
        RFC 9562 UUID Version 7 (Time-Ordered 48-bit timestamp + random).
        """
        ms = int(time.time() * 1000)
        rand = os.urandom(10)
        b = bytearray(16)
        b[0:6] = ms.to_bytes(6, byteorder="big")
        b[6] = 0x70 | (rand[0] & 0x0F)
        b[7] = rand[1]
        b[8] = 0x80 | (rand[2] & 0x3F)
        b[9:16] = rand[3:10]
        return str(uuid.UUID(bytes=bytes(b)))

    @staticmethod
    def _generate_ulid() -> str:
        """
        26-character Crockford Base32 Universally Unique Lexicographically Sortable Identifier.
        """
        ms = int(time.time() * 1000)
        rand = os.urandom(10)
        val = (ms << 80) | int.from_bytes(rand, byteorder="big")
        chars = [CROCKFORD_BASE32[(val >> (5 * i)) & 0x1F] for i in range(26)]
        return "".join(reversed(chars))
