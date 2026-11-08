"""Hỗ trợ văn bản bằng AI nguồn mở (viết lại, tóm tắt, sửa lỗi, viết tiếp, dịch).

Dùng chung nhà cung cấp với nhận dạng: Ollama (mô hình văn bản mở) hoặc Claude.
"""
import json
import os
import urllib.request

from .recognize import _provider, _ollama_url

TEXT_MODEL = os.environ.get("VPVIE_OLLAMA_TEXT_MODEL", "qwen2.5:7b")

PROMPTS = {
    "rewrite": "Viết lại đoạn văn sau cho rõ ràng, mạch lạc, giữ nguyên ý nghĩa, bằng tiếng Việt. Chỉ trả về văn bản đã viết lại:",
    "summarize": "Tóm tắt ngắn gọn, rõ ý đoạn văn sau bằng tiếng Việt:",
    "fix": "Sửa lỗi chính tả và ngữ pháp trong đoạn sau (giữ nguyên nội dung). Chỉ trả về văn bản đã sửa:",
    "continue": "Viết tiếp đoạn văn sau một cách tự nhiên, mạch lạc, bằng tiếng Việt:",
    "expand": "Bổ sung ý và mở rộng đoạn văn sau bằng tiếng Việt:",
    "translate_en": "Dịch đoạn văn sau sang tiếng Anh. Chỉ trả về bản dịch:",
}


def tasks():
    return list(PROMPTS.keys())


def assist(text, task):
    prompt = PROMPTS.get(task, PROMPTS["rewrite"]) + "\n\n" + (text or "")
    if _provider() == "anthropic":
        from anthropic import Anthropic
        c = Anthropic()
        m = c.messages.create(model="claude-opus-5-5", max_tokens=2048, messages=[{"role": "user", "content": prompt}])
        return "".join(getattr(b, "text", "") for b in m.content if getattr(b, "type", "") == "text").strip()
    body = json.dumps({"model": TEXT_MODEL, "prompt": prompt, "stream": False}).encode("utf-8")
    req = urllib.request.Request(_ollama_url() + "/api/generate", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return (json.loads(r.read().decode("utf-8")).get("response") or "").strip()
