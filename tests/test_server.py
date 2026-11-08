"""Kiểm thử backend VPVie (không gọi AI thật)."""
import os
from fastapi.testclient import TestClient

os.environ["VPVIE_AI_PROVIDER"] = "anthropic"   # ép nhà cung cấp cần khóa để kiểm tra 503
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)

from vpvie.server.app import app  # noqa: E402

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["app"] == "VPVie"
    assert "ai" in d


def test_recognize_requires_key():
    r = client.post("/api/recognize", json={"image": "xxx", "mode": "auto"})
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in r.json()["error"]


def test_index_served():
    r = client.get("/")
    assert r.status_code == 200
    assert "VPVie" in r.text
