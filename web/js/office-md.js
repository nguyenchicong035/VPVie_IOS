(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var src = $("src"), prev = $("prev"), saveNote = $("save-note");
  function render() { try { prev.innerHTML = window.marked.parse(src.value); } catch (e) { prev.textContent = src.value; } $("wc").textContent = (src.value.trim() ? src.value.trim().split(/\s+/).length : 0) + " từ"; }
  var t = null; function save() { clearTimeout(t); t = setTimeout(function () { try { localStorage.setItem("vpvie.md", src.value); saveNote.textContent = "Đã lưu"; setTimeout(function(){saveNote.textContent="";},1200); } catch (e) {} }, 400); }
  src.addEventListener("input", function () { render(); save(); });
  try { var s = localStorage.getItem("vpvie.md"); if (s) src.value = s; } catch (e) {}
  if (!src.value) src.value = "# Bài giảng\n\n- Mục 1\n- Mục 2\n\n**In đậm**, *in nghiêng*, `mã`.\n\n> Trích dẫn\n";
  render();
  $("dl").onclick = function () { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([src.value], { type: "text/markdown" })); a.download = "tailieu.md"; a.click(); };
  $("pdf").onclick = function () { window.print(); };
  // AI
  var menu = $("ai-menu");
  $("ai-btn").onclick = function (e) { e.stopPropagation(); var r = this.getBoundingClientRect(); menu.style.left = r.left + "px"; menu.style.top = (r.bottom + 4) + "px"; menu.classList.toggle("show"); };
  document.addEventListener("click", function () { menu.classList.remove("show"); });
  menu.addEventListener("click", function (e) { e.stopPropagation(); });
  menu.querySelectorAll("button").forEach(function (b) { b.onclick = async function () {
    menu.classList.remove("show");
    var a = src.selectionStart, z = src.selectionEnd, selText = src.value.slice(a, z);
    var text = selText || src.value; if (!text.trim()) { alert("Chưa có nội dung."); return; }
    saveNote.textContent = "AI đang xử lý…";
    try { var res = await fetch("./api/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ text: text, task: b.dataset.task }, (window.VPLicense ? window.VPLicense.creds() : {}))) }); var d = await res.json(); if (!res.ok || !d.ok) throw new Error(d.error || "Lỗi");
      if (selText) { src.setRangeText(d.text, a, z, "end"); } else { src.value += "\n\n" + d.text; } render(); save(); saveNote.textContent = "";
    } catch (err) { saveNote.textContent = ""; alert(err.message || "Lỗi AI"); }
  }; });
})();
