"""Tạo dàn ý slide bài giảng bằng AI nguồn mở (Ollama) hoặc Claude."""
import json
import re

from .recognize import _provider, _ollama_url
from .assist import TEXT_MODEL


def _prompt(topic, n):
    return (
        f'Bạn là trợ lý tạo slide bài giảng tiếng Việt. Tạo {n} slide cho chủ đề: "{topic}". '
        'Trả về DUY NHẤT một JSON: {"slides":[{"title":"...","bullets":["...","..."]}]}. '
        'Slide đầu là slide tiêu đề (bullets ngắn giới thiệu). Mỗi slide sau có 3–5 gạch đầu dòng ngắn gọn, rõ ý, bằng tiếng Việt. '
        "Không kèm giải thích, không bọc ```."
    )


def _extract(text):
    text = (text or "").strip()
    text = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def generate(topic, n=6):
    prompt = _prompt(topic, max(2, min(int(n or 6), 15)))
    if _provider() == "anthropic":
        from anthropic import Anthropic
        c = Anthropic()
        m = c.messages.create(model="claude-opus-5-5", max_tokens=2048, messages=[{"role": "user", "content": prompt}])
        text = "".join(getattr(b, "text", "") for b in m.content if getattr(b, "type", "") == "text")
    else:
        import urllib.request
        body = json.dumps({"model": TEXT_MODEL, "prompt": prompt, "stream": False, "format": "json"}).encode("utf-8")
        req = urllib.request.Request(_ollama_url() + "/api/generate", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r:
            text = (json.loads(r.read().decode("utf-8")).get("response") or "")
    data = _extract(text)
    slides = data.get("slides") or []
    out = []
    for s in slides:
        out.append({"title": (s.get("title") or "").strip(), "bullets": [str(x).strip() for x in (s.get("bullets") or []) if str(x).strip()]})
    return {"slides": out}
