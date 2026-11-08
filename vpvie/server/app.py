"""Máy chủ VPVie: phục vụ giao diện web + API nhận dạng nét vẽ bằng AI."""
import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ..version import __version__, APP_NAME
from ..ai import recognize as ai_recognize, available as ai_available
from ..ai.recognize import provider_info
from ..ai import assist as ai_assist
from ..ai import slides as ai_slides
from .. import license as lic

WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "web")

app = FastAPI(title=f"{APP_NAME} – Bảng dạy học", version=__version__)


class RecognizeIn(BaseModel):
    image: str          # ảnh PNG mã hóa base64 (không kèm tiền tố data:)
    mode: str = "auto"  # auto | text | math
    license: str = ""   # key kích hoạt (khi máy chủ bật VPVIE_REQUIRE_LICENSE)
    machine: str = ""   # mã máy


def _license_guard(body):
    """Trả JSONResponse lỗi nếu bật kiểm tra bản quyền và key không hợp lệ; None nếu hợp lệ."""
    r = lic.check_request(getattr(body, "license", ""), getattr(body, "machine", ""))
    if not r["ok"]:
        return JSONResponse(status_code=402, content={"ok": False, "need_license": True, "error": "Tính năng AI cần bản quyền: " + r["reason"] + "."})
    return None


@app.get("/api/health")
def health():
    return {"ok": True, "app": APP_NAME, "version": __version__, "ai": ai_available(), "require_license": lic.require_license(), **provider_info()}


@app.post("/api/recognize")
def recognize(body: RecognizeIn):
    g = _license_guard(body)
    if g: return g
    if not ai_available():
        return JSONResponse(
            status_code=503,
            content={"ok": False, "error": "Chưa cấu hình khóa AI. Đặt biến môi trường ANTHROPIC_API_KEY để bật nhận dạng trực tuyến."},
        )
    img = body.image
    if "," in img and img.strip().startswith("data:"):
        img = img.split(",", 1)[1]
    try:
        result = ai_recognize(img, body.mode)
        return {"ok": True, **result}
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"ok": False, "error": f"Lỗi nhận dạng: {e}"})


class AssistIn(BaseModel):
    text: str
    task: str = "rewrite"
    license: str = ""
    machine: str = ""


@app.post("/api/assist")
def assist(body: AssistIn):
    g = _license_guard(body)
    if g: return g
    if not ai_available():
        return JSONResponse(status_code=503, content={"ok": False, "error": "Chưa bật AI. Dùng Ollama (miễn phí) hoặc đặt ANTHROPIC_API_KEY."})
    try:
        return {"ok": True, "text": ai_assist.assist(body.text, body.task)}
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"ok": False, "error": f"Lỗi AI: {e}"})


class SlidesIn(BaseModel):
    topic: str
    n: int = 6
    license: str = ""
    machine: str = ""


@app.post("/api/slides")
def slides(body: SlidesIn):
    g = _license_guard(body)
    if g: return g
    if not ai_available():
        return JSONResponse(status_code=503, content={"ok": False, "error": "Chưa bật AI. Dùng Ollama (miễn phí) hoặc đặt ANTHROPIC_API_KEY."})
    try:
        return {"ok": True, **ai_slides.generate(body.topic, body.n)}
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"ok": False, "error": f"Lỗi tạo slide: {e}"})


class ActivateIn(BaseModel):
    license: str = ""
    machine: str = ""


@app.post("/api/activate")
def activate(body: ActivateIn):
    """Kích hoạt một máy cho một key (hỗ trợ key nhiều máy, đếm số máy)."""
    r = lic.activate(body.license, body.machine)
    code = 200 if r["ok"] else 402
    out = {"ok": r["ok"]}
    if not r["ok"]:
        out["error"] = r["reason"]
    if "used" in r:
        out["used"] = r["used"]
        out["maxm"] = r["maxm"]
    if r.get("data"):
        out["plan"] = r["data"].get("p", "pro")
        out["expiry"] = r["data"].get("e", 0)
    return JSONResponse(status_code=code, content=out)


from fastapi import Header


def _admin_guard(token):
    if not lic.admin_enabled():
        return JSONResponse(status_code=403, content={"ok": False, "error": "Chưa bật quản trị. Đặt biến môi trường VPVIE_ADMIN_TOKEN rồi khởi động lại."})
    if not lic.admin_check(token or ""):
        return JSONResponse(status_code=401, content={"ok": False, "error": "Token quản trị sai."})
    return None


@app.get("/api/admin/activations")
def admin_activations(x_admin_token: str = Header(default="")):
    g = _admin_guard(x_admin_token)
    if g:
        return g
    return {"ok": True, **lic.list_activations()}


class AdminMachineIn(BaseModel):
    lid: str
    machine: str


@app.post("/api/admin/machine-remove")
def admin_machine_remove(body: AdminMachineIn, x_admin_token: str = Header(default="")):
    g = _admin_guard(x_admin_token)
    if g:
        return g
    r = lic.remove_machine(body.lid, body.machine)
    return JSONResponse(status_code=200 if r["ok"] else 400, content=r)


class AdminRevokeIn(BaseModel):
    key_or_id: str
    revoked: bool = True


@app.post("/api/admin/revoke")
def admin_revoke(body: AdminRevokeIn, x_admin_token: str = Header(default="")):
    g = _admin_guard(x_admin_token)
    if g:
        return g
    r = lic.set_revoked(body.key_or_id, body.revoked)
    return JSONResponse(status_code=200 if r["ok"] else 400, content=r)


TOOLS_DIR = os.path.join(os.path.dirname(WEB_DIR), "tools", "vpvie-keygen")


@app.get("/quan-ly-key.html")
def admin_page():
    """Trang quản lý bản quyền (người phát hành) — phục vụ cùng máy chủ để gọi API."""
    return FileResponse(os.path.join(TOOLS_DIR, "quan-ly-key.html"))


@app.get("/cap-key.html")
def issue_page():
    return FileResponse(os.path.join(TOOLS_DIR, "cap-key.html"))


@app.get("/")
def index():
    return FileResponse(os.path.join(WEB_DIR, "index.html"))


# Phục vụ toàn bộ tệp tĩnh trong web/
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
