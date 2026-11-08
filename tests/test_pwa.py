"""Kiểm tra hợp đồng PWA và các đường dẫn tĩnh quan trọng."""
import json
from pathlib import Path


WEB = Path(__file__).parents[1] / "web"


def test_manifest_is_scoped_and_installable():
    manifest = json.loads((WEB / "manifest.webmanifest").read_text(encoding="utf-8"))
    assert manifest["display"] == "standalone"
    assert manifest["scope"] == "./"
    assert manifest["start_url"].startswith("./")
    sizes = {icon["sizes"] for icon in manifest["icons"]}
    assert {"180x180", "192x192", "512x512"} <= sizes


def test_all_pages_share_pwa_metadata_and_bootstrap():
    pages = list(WEB.glob("*.html"))
    assert pages
    for page in pages:
        html = page.read_text(encoding="utf-8")
        assert "viewport-fit=cover" in html, page.name
        assert "manifest.webmanifest" in html, page.name
        assert "apple-mobile-web-app-capable" in html, page.name
        assert "./js/pwa.js" in html, page.name


def test_service_worker_core_assets_exist():
    required = [
        "index.html", "bang.html", "soanthao.html", "markdown.html",
        "htmledit.html", "bangtinh.html", "trinhchieu.html", "pdf.html",
        "style.css", "office.css", "oxyz.css", "js/pwa.js",
        "icons/icon-192.png", "icons/icon-512.png",
    ]
    assert all((WEB / path).is_file() for path in required)
