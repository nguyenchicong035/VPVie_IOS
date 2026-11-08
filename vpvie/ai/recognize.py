"""Nhận dạng nét vẽ tay (chữ tiếng Việt / công thức) – AI nguồn mở miễn phí.

Nhà cung cấp (VPVIE_AI_PROVIDER):
  - "ollama"    : gọi mô hình thị giác MỞ chạy cục bộ qua Ollama (miễn phí). Mặc định.
  - "anthropic" : gọi Claude (tùy chọn, cần ANTHROPIC_API_KEY).
Giao diện web còn có Tesseract.js (nguồn mở) chạy ngay trong trình duyệt, không cần máy chủ.

AI chỉ nhận dạng nội dung có trong hình, không bịa; tính toán/đồ thị do thư viện thật xử lý.
"""
import json
import os
import re
import urllib.request

def _provider():
    return os.environ.get("VPVIE_AI_PROVIDER", "ollama").lower()


# ----- pix2tex (LaTeX-OCR) – mô hình nguồn mở chuyên nhận công thức -> LaTeX
_P2T_MODEL = None
_P2T_ERR = None


def _pix2tex_model():
    """Nạp mô hình LatexOCR một lần (tải trọng số lần đầu). Trả None nếu không khả dụng."""
    global _P2T_MODEL, _P2T_ERR
    if _P2T_MODEL is not None or _P2T_ERR is not None:
        return _P2T_MODEL
    try:
        from pix2tex.cli import LatexOCR  # type: ignore
        _P2T_MODEL = LatexOCR()
    except Exception as e:  # thiếu gói, thiếu torch, hoặc không tải được trọng số
        _P2T_ERR = str(e)
        _P2T_MODEL = None
    return _P2T_MODEL


def _pix2tex(image_png_b64: str, mode: str) -> dict:
    import base64
    import io
    model = _pix2tex_model()
    if model is None:
        raise RuntimeError(
            "Chưa bật được pix2tex (LaTeX-OCR). Cài: pip install \"pix2tex[api]\" và đảm bảo tải được trọng số mô hình. "
            + ("Chi tiết: " + _P2T_ERR if _P2T_ERR else "")
        )
    from PIL import Image  # type: ignore
    img = Image.open(io.BytesIO(base64.b64decode(image_png_b64))).convert("RGB")
    latex = (model(img) or "").strip()
    return {"kind": "math", "text": "", "latex": latex}


def _ollama_url():
    return os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")


def _ollama_model():
    return os.environ.get("VPVIE_OLLAMA_MODEL", "qwen2.5vl:7b")

_SYSTEM = (
    "Bạn là công cụ nhận dạng nét vẽ tay TOÁN HỌC trên bảng dạy học của giáo viên Việt Nam. "
    "Người dùng gửi ảnh nét vẽ tay: công thức toán, hoặc chữ tiếng Việt có dấu, hoặc cả hai. "
    "Hãy nhận dạng CHÍNH XÁC nội dung CÓ trong ảnh, không thêm bớt, KHÔNG giải bài. "
    "Chỉ trả về một JSON: "
    '{"kind":"text|math|mixed","text":"<chữ tiếng Việt nếu có>","latex":"<LaTeX kiểu KaTeX cho công thức>"}. '
    "QUY TẮC CÔNG THỨC (quan trọng): xuất LaTeX chuẩn KaTeX — "
    "lũy thừa dùng ^{ }, chỉ số dùng _{ }, phân số \\frac{}{}, căn \\sqrt{} và \\sqrt[n]{}, "
    "tích phân \\int_{a}^{b} f(x)\\,dx, nguyên hàm \\int f(x)\\,dx, tổng \\sum_{i=1}^{n}, "
    "đạo hàm f'(x) hoặc \\frac{dy}{dx} hoặc \\frac{\\partial}{\\partial x}, giới hạn \\lim_{x\\to a}, "
    "hệ phương trình \\begin{cases}...\\end{cases}, ma trận \\begin{pmatrix}...\\end{pmatrix}, "
    "ký hiệu: \\pi \\infty \\le \\ge \\neq \\pm \\times \\cdot \\in \\subset \\cup \\cap \\to \\Delta \\alpha \\beta \\theta. "
    "Chỉ là chữ -> kind=text (giữ nguyên dấu tiếng Việt). Có công thức -> kind=math (hoặc mixed nếu có cả chữ), điền latex. "
    "Nhận diện tốt nét chữ viết tay tiếng Việt (a ă â e ê o ô ơ u ư d đ và dấu sắc/huyền/hỏi/ngã/nặng). "
    "Không bọc JSON trong dấu ```."
)


def available() -> bool:
    p = _provider()
    if p == "anthropic":
        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
    if p == "ollama":
        return True  # cần Ollama chạy cục bộ; lỗi kết nối sẽ báo khi gọi
    if p == "pix2tex":
        return _pix2tex_model() is not None
    return False


def provider_info() -> dict:
    p = _provider()
    model = {
        "ollama": _ollama_model(),
        "anthropic": "claude-opus-5-5",
        "pix2tex": "pix2tex (LaTeX-OCR)",
    }.get(p, p)
    return {"provider": p, "model": model}


def _hint(mode: str) -> str:
    return {
        "text": "Ưu tiên nhận dạng thành CHỮ tiếng Việt.",
        "math": "Ưu tiên nhận dạng thành CÔNG THỨC toán (LaTeX).",
        "auto": "Tự phân biệt chữ hay công thức.",
    }.get(mode, "Tự phân biệt chữ hay công thức.")


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            return json.loads(m.group(0))
        return {"kind": "text", "text": text}


def _normalize(data: dict) -> dict:
    return {
        "kind": data.get("kind", "text"),
        "text": (data.get("text") or "").strip(),
        "latex": (data.get("latex") or "").strip(),
    }


def _ollama(image_png_b64: str, mode: str) -> dict:
    body = json.dumps({
        "model": _ollama_model(),
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _hint(mode) + " Trả JSON như quy định.", "images": [image_png_b64]},
        ],
    }).encode("utf-8")
    req = urllib.request.Request(_ollama_url() + "/api/chat", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.loads(r.read().decode("utf-8"))
    content = (resp.get("message") or {}).get("content", "")
    return _normalize(_extract_json(content))


def _anthropic(image_png_b64: str, mode: str) -> dict:
    from anthropic import Anthropic
    client = Anthropic()
    msg = client.messages.create(
        model="claude-opus-5-5", max_tokens=1024, system=_SYSTEM,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_png_b64}},
            {"type": "text", "text": _hint(mode) + " Trả JSON như quy định."},
        ]}],
    )
    text = "".join(getattr(b, "text", "") for b in msg.content if getattr(b, "type", "") == "text")
    return _normalize(_extract_json(text))


def recognize(image_png_b64: str, mode: str = "auto") -> dict:
    p = _provider()
    if p == "pix2tex":
        return _pix2tex(image_png_b64, mode)
    if p == "anthropic":
        return _anthropic(image_png_b64, mode)
    return _ollama(image_png_b64, mode)
