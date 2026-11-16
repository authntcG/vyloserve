import re
import uuid
import pytest
from unittest.mock import MagicMock
from core.services.crypto_tools import CryptoTools, CROCKFORD_BASE32
from core.api import Api


@pytest.fixture
def mock_api():
    api = MagicMock()
    return api


@pytest.fixture
def crypto_service(mock_api):
    return CryptoTools(mock_api)


def test_crypto_tools_init(crypto_service, mock_api):
    assert crypto_service.api == mock_api


def test_generate_bcrypt_hash_happy_path(crypto_service):
    res = crypto_service.generate_bcrypt_hash("mysecretpassword", rounds=4, prefix="2y")
    assert res["status"] == "success"
    assert res["hash"].startswith("$2y$04$")
    assert res["rounds"] == 4
    assert res["prefix"] == "2y"

    # Test $2b$ prefix
    res2 = crypto_service.generate_bcrypt_hash("mysecretpassword", rounds=4, prefix="2b")
    assert res2["status"] == "success"
    assert res2["hash"].startswith("$2b$04$")


def test_generate_bcrypt_hash_clamping(crypto_service):
    # Below min rounds 4
    res_low = crypto_service.generate_bcrypt_hash("test", rounds=2)
    assert res_low["status"] == "success"
    assert res_low["rounds"] == 4

    # Above max rounds 14
    res_high = crypto_service.generate_bcrypt_hash("test", rounds=20)
    assert res_high["status"] == "success"
    assert res_high["rounds"] == 14


def test_generate_bcrypt_hash_invalid_input(crypto_service):
    res = crypto_service.generate_bcrypt_hash(None)
    assert res["status"] == "error"
    assert res["message"] == "backend.crypto.invalid_input"


def test_verify_bcrypt_hash(crypto_service):
    gen = crypto_service.generate_bcrypt_hash("correct_password", rounds=4, prefix="2y")
    assert gen["status"] == "success"
    hash_str = gen["hash"]

    # Valid match
    match_res = crypto_service.verify_bcrypt_hash("correct_password", hash_str)
    assert match_res["status"] == "success"
    assert match_res["is_match"] is True
    assert match_res["message"] == "backend.crypto.verify_match"

    # Mismatch
    mismatch_res = crypto_service.verify_bcrypt_hash("wrong_password", hash_str)
    assert mismatch_res["status"] == "success"
    assert mismatch_res["is_match"] is False
    assert mismatch_res["message"] == "backend.crypto.verify_mismatch"


def test_verify_bcrypt_hash_invalid_input(crypto_service):
    res1 = crypto_service.verify_bcrypt_hash("pass", "")
    assert res1["status"] == "error"
    assert res1["message"] == "backend.crypto.invalid_input"

    res2 = crypto_service.verify_bcrypt_hash(None, "some_hash")
    assert res2["status"] == "error"
    assert res2["message"] == "backend.crypto.invalid_input"


def test_generate_ids_uuid4(crypto_service):
    res = crypto_service.generate_ids(kind="uuid4", count=3)
    assert res["status"] == "success"
    assert res["count"] == 3
    assert len(res["ids"]) == 3
    for id_str in res["ids"]:
        parsed = uuid.UUID(id_str)
        assert parsed.version == 4


def test_generate_ids_uuid7(crypto_service):
    res = crypto_service.generate_ids(kind="uuid7", count=2)
    assert res["status"] == "success"
    assert res["count"] == 2
    for id_str in res["ids"]:
        parsed = uuid.UUID(id_str)
        assert parsed.version == 7


def test_generate_ids_ulid(crypto_service):
    res = crypto_service.generate_ids(kind="ulid", count=3)
    assert res["status"] == "success"
    assert res["count"] == 3
    for ulid_str in res["ids"]:
        assert len(ulid_str) == 26
        assert all(c in CROCKFORD_BASE32 for c in ulid_str)


def test_generate_ids_clamping(crypto_service):
    res_zero = crypto_service.generate_ids(kind="uuid4", count=0)
    assert res_zero["count"] == 1

    res_large = crypto_service.generate_ids(kind="uuid4", count=100)
    assert res_large["count"] == 50


def test_generate_text_hashes(crypto_service):
    text = "VyloServe Dev Suite"
    res = crypto_service.generate_text_hashes(text)
    assert res["status"] == "success"
    hashes = res["hashes"]

    assert "md5" in hashes
    assert "sha1" in hashes
    assert "sha256" in hashes
    assert "sha512" in hashes
    assert "crc32" in hashes

    # Verify sha256 output length
    assert len(hashes["sha256"]) == 64
    assert len(hashes["md5"]) == 32
    assert len(hashes["sha512"]) == 128


def test_generate_text_hashes_invalid_input(crypto_service):
    res = crypto_service.generate_text_hashes(123)
    assert res["status"] == "error"
    assert res["message"] == "backend.crypto.invalid_input"


def test_api_facade_crypto_tools():
    api = Api()
    assert hasattr(api, "crypto_tools")
    assert api.crypto == api.crypto_tools

    h_res = api.generate_bcrypt_hash("test", rounds=4)
    assert h_res["status"] == "success"

    v_res = api.verify_bcrypt_hash("test", h_res["hash"])
    assert v_res["is_match"] is True

    id_res = api.generate_crypto_ids("uuid4", 2)
    assert id_res["count"] == 2

    hash_res = api.generate_text_hashes("hello")
    assert hash_res["status"] == "success"
