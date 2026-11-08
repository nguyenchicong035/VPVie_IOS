"""Kiểm thử bộ phân tích JSON của module nhận dạng (không gọi mạng)."""
from vpvie.ai.recognize import _extract_json, available


def test_extract_plain():
    assert _extract_json('{"kind":"math","latex":"x^2-3x=0"}')["latex"] == "x^2-3x=0"


def test_extract_fenced():
    s = '```json\n{"kind":"text","text":"Xin chào"}\n```'
    assert _extract_json(s)["text"] == "Xin chào"


def test_extract_embedded():
    s = 'Đây là kết quả: {"kind":"text","text":"ABC"} nhé'
    assert _extract_json(s)["text"] == "ABC"
