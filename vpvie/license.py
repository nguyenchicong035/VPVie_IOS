"""Kiểm tra bản quyền phía máy chủ (chống crack cho tính năng AI).

Dùng chung khoá công khai ECDSA P-256 với web/js/license.js. Máy chủ chỉ trả kết quả
AI khi request kèm một Key hợp lệ (chữ ký đúng + chưa hết hạn). Nhờ vậy, dù ai sửa mã
client cho "đã kích hoạt" thì vẫn không lấy được kết quả AI nếu không có Key thật.

Bật kiểm tra bằng biến môi trường:  VPVIE_REQUIRE_LICENSE=1
(Mặc định TẮT để bản miễn phí / phát triển vẫn chạy bình thường.)

Thu hồi key: liệt kê các payload-id bị thu hồi trong tệp JSON trỏ bởi
VPVIE_REVOKED_KEYS (danh sách chuỗi "m" mã máy, hoặc cả key).
"""
import base64
import json
import os
import time

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.exceptions import InvalidSignature

# Khoá công khai (SPKI, base64url) — PHẢI trùng với PUBKEY_SPKI_B64URL trong web/js/license.js
PUBKEY_SPKI_B64URL = os.environ.get(
    "VPVIE_PUBKEY",
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESxiHdNT7DPa3mjwhc4DKeS7-LvWt2mtmiiBXCp07Ocfw6i_ldz4quXg1jGLM7vq1dQmQDGMAmyBgUihOxZD38w",
)


def _b64url_bytes(s: str) -> bytes:
    s = s.replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    return base64.b64decode(s)


def _load_pubkey():
    der = _b64url_bytes(PUBKEY_SPKI_B64URL)
    return serialization.load_der_public_key(der)


_PUB = None


def require_license() -> bool:
    """Có bắt buộc kiểm tra bản quyền cho API AI không?"""
    return os.environ.get("VPVIE_REQUIRE_LICENSE", "").strip() in ("1", "true", "yes", "on")


    try:
        with open(path, "r", encoding="utf-8") as f:
            return set(json.load(f))
    except Exception:  # noqa: BLE001
        return set()


def verify(key: str, machine_id: str = "") -> dict:
    """Trả {ok, reason, data}. Chữ ký ECDSA P-256 dạng ieee-p1363 (r||s, 64 byte)."""
    global _PUB
    key = (key or "").strip()
    parts = key.split(".")
    if len(parts) != 3 or parts[0] != "VPL1":
        return {"ok": False, "reason": "Key sai định dạng"}
    try:
        payload_bytes = _b64url_bytes(parts[1])
        data = json.loads(payload_bytes.decode("utf-8"))
        sig = _b64url_bytes(parts[2])
    except Exception:  # noqa: BLE001
        return {"ok": False, "reason": "Key hỏng"}
    if len(sig) != 64:
        return {"ok": False, "reason": "Chữ ký sai độ dài"}
    r = int.from_bytes(sig[:32], "big")
    s = int.from_bytes(sig[32:], "big")
    try:
        if _PUB is None:
            _PUB = _load_pubkey()
        _PUB.verify(encode_dss_signature(r, s), payload_bytes, ec.ECDSA(hashes.SHA256()))
    except InvalidSignature:
        return {"ok": False, "reason": "Chữ ký không hợp lệ"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "reason": f"Lỗi kiểm tra: {e}"}
    # Ràng buộc máy (client gửi mã máy; forger không ký được nên vẫn an toàn)
    if machine_id and data.get("m") and data["m"] != machine_id:
        return {"ok": False, "reason": "Key cấp cho máy khác"}
    if data.get("e") and data["e"] > 0 and time.time() > data["e"]:
        return {"ok": False, "reason": "Key đã hết hạn"}
    rev = set(_load_revoked_list())
    if data.get("m") in rev or data.get("id") in rev or key in rev:
        return {"ok": False, "reason": "Key đã bị thu hồi"}
    return {"ok": True, "reason": "", "data": data}


def check_request(key: str, machine_id: str = "") -> dict:
    """Dùng trong API: nếu không bắt buộc license thì luôn cho qua.

    Với key nhiều máy (có "id"), yêu cầu máy ĐÃ kích hoạt (có trong kho) → buộc
    phải gọi /api/activate trước, nhờ đó giới hạn số máy có hiệu lực cả ở API.
    """
    if not require_license():
        return {"ok": True, "reason": "", "data": {"p": "free"}}
    r = verify(key, machine_id)
    if not r["ok"]:
        return r
    data = r["data"]
    if data.get("id"):
        mid = (machine_id or "").strip().upper()
        rec = _load_store().get(data["id"])
        if not rec or mid not in rec.get("machines", []):
            return {"ok": False, "reason": "Máy chưa kích hoạt key này"}
    return r


# ----- Kích hoạt qua máy chủ (hướng C): một key dùng tối đa N máy -----
def _store_path() -> str:
    return os.environ.get("VPVIE_ACTIVATIONS", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "activations.json"))


def _load_store() -> dict:
    path = _store_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def _save_store(store: dict) -> None:
    try:
        with open(_store_path(), "w", encoding="utf-8") as f:
            json.dump(store, f, ensure_ascii=False, indent=0)
    except Exception:  # noqa: BLE001
        pass


def activate(key: str, machine_id: str) -> dict:
    """Kích hoạt một máy cho một key. Trả {ok, reason, data, used, maxm}.

    - Key gắn 1 máy (có "m"): chỉ kiểm chữ ký + ràng buộc máy (không cần đếm).
    - Key nhiều máy (có "id" + "maxm"): đếm số máy đã kích hoạt, chặn khi vượt.
    """
    machine_id = (machine_id or "").strip().upper()
    r = verify(key, machine_id)
    if not r["ok"]:
        return r
    data = r["data"]
    lid = data.get("id")
    if not lid:  # key gắn máy — không cần máy chủ
        return {"ok": True, "reason": "", "data": data, "used": 1, "maxm": 1}
    if not machine_id:
        return {"ok": False, "reason": "Thiếu mã máy"}
    maxm = int(data.get("maxm", 1))
    store = _load_store()
    rec = store.get(lid) or {"machines": [], "note": data.get("n", "")}
    machines = rec.get("machines", [])
    if machine_id not in machines:
        if len(machines) >= maxm:
            return {"ok": False, "reason": f"Key đã dùng đủ {maxm} máy. Liên hệ người cấp phép để tăng hoặc gỡ máy cũ.", "used": len(machines), "maxm": maxm}
        machines.append(machine_id)
        rec["machines"] = machines
        store[lid] = rec
        _save_store(store)
    return {"ok": True, "reason": "", "data": data, "used": len(machines), "maxm": maxm}


# ----- Quản trị (dùng cho trang quản lý key) -----
def _revoked_path() -> str:
    return os.environ.get("VPVIE_REVOKED_KEYS", "").strip() or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "revoked.json")


def _load_revoked_list() -> list:
    path = _revoked_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return list(json.load(f))
    except Exception:  # noqa: BLE001
        return []


def _save_revoked_list(items) -> None:
    try:
        with open(_revoked_path(), "w", encoding="utf-8") as f:
            json.dump(sorted(set(items)), f, ensure_ascii=False, indent=0)
    except Exception:  # noqa: BLE001
        pass


def admin_enabled() -> bool:
    return bool(os.environ.get("VPVIE_ADMIN_TOKEN", "").strip())


def admin_check(token: str) -> bool:
    want = os.environ.get("VPVIE_ADMIN_TOKEN", "").strip()
    return bool(want) and token == want


def list_activations() -> dict:
    """Trả toàn bộ dữ liệu kích hoạt + danh sách thu hồi (cho trang quản lý)."""
    return {"activations": _load_store(), "revoked": _load_revoked_list()}


def remove_machine(lid: str, machine: str) -> dict:
    store = _load_store()
    rec = store.get(lid)
    if not rec:
        return {"ok": False, "reason": "Không thấy license id"}
    machine = (machine or "").strip().upper()
    if machine in rec.get("machines", []):
        rec["machines"] = [m for m in rec["machines"] if m != machine]
        store[lid] = rec
        _save_store(store)
        return {"ok": True, "used": len(rec["machines"])}
    return {"ok": False, "reason": "Máy không có trong key này"}


def set_revoked(key_or_id: str, revoked: bool) -> dict:
    key_or_id = (key_or_id or "").strip()
    if not key_or_id:
        return {"ok": False, "reason": "Thiếu id/key"}
    items = _load_revoked_list()
    if revoked and key_or_id not in items:
        items.append(key_or_id)
    elif not revoked:
        items = [x for x in items if x != key_or_id]
    _save_revoked_list(items)
    return {"ok": True, "revoked": _load_revoked_list()}
