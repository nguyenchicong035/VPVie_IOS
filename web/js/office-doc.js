// VPVie – Soạn thảo văn bản (kiểu Word). execCommand + AI hỗ trợ + lưu/xuất.
(function () {
  "use strict";
  var doc = document.getElementById("doc");
  var $ = function (id) { return document.getElementById(id); };
  var saveNote = $("save-note");
  function exec(cmd, val) { doc.focus(); document.execCommand(cmd, false, val || null); updateWC(); scheduleSave(); }

  // Nút định dạng cơ bản
  document.querySelectorAll("[data-cmd]").forEach(function (b) { b.onmousedown = function (e) { e.preventDefault(); }; b.onclick = function () { exec(b.dataset.cmd); }; });
  $("block").onchange = function () { exec("formatBlock", this.value === "P" ? "P" : this.value); };
  $("fsize").onchange = function () { exec("fontSize", this.value); };
  $("fcolor").oninput = function () { exec("foreColor", this.value); };
  $("hcolor").oninput = function () { exec("hiliteColor", this.value); exec("backColor", this.value); };
  $("link").onclick = function () { var u = prompt("Nhập địa chỉ liên kết:", "https://"); if (u) exec("createLink", u); };
  $("table").onclick = function () {
    var r = parseInt(prompt("Số hàng:", "3"), 10), c = parseInt(prompt("Số cột:", "3"), 10);
    if (!r || !c) return;
    var h = '<table style="border-collapse:collapse;width:100%"><tbody>';
    for (var i = 0; i < r; i++) { h += "<tr>"; for (var j = 0; j < c; j++) h += '<td style="border:1px solid #888;padding:6px;min-width:40px">&nbsp;</td>'; h += "</tr>"; }
    h += "</tbody></table><p></p>"; exec("insertHTML", h);
  };
  $("image").onclick = function () { $("img-file").click(); };
  $("img-file").onchange = function () {
    var f = this.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { exec("insertImage", rd.result); }; rd.readAsDataURL(f); this.value = "";
  };
  $("export-html").onclick = function () {
    var html = "<!doctype html><meta charset='utf-8'><body style='font-family:Segoe UI,Arial,sans-serif;max-width:800px;margin:auto;padding:30px'>" + doc.innerHTML + "</body>";
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = "vanban.html"; a.click();
  };
  $("export-pdf").onclick = function () { window.print(); };
  $("font").onchange = function () { if (this.value) exec("fontName", this.value); };
  $("quote").onclick = function () { exec("formatBlock", "blockquote"); };
  $("math").onclick = function () {
    var tex = prompt("Nhập công thức LaTeX:", "\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}");
    if (!tex) return;
    var span = document.createElement("span"); span.className = "mathchip"; span.contentEditable = "false"; span.setAttribute("data-latex", tex);
    try { window.katex.render(tex, span, { throwOnError: false }); } catch (e) { span.textContent = tex; }
    doc.focus();
    var sel = window.getSelection();
    if (sel.rangeCount) { var r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(span); r.setStartAfter(span); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
    else doc.appendChild(span);
    scheduleSave(); updateWC();
  };
  // Tìm & thay thế
  $("find").onclick = function () { var fb = $("find-bar"); fb.classList.toggle("show"); if (fb.classList.contains("show")) $("find-q").focus(); };
  $("find-close").onclick = function () { $("find-bar").classList.remove("show"); };
  $("find-all").onclick = function () {
    var q = $("find-q").value, rep = $("find-r").value; if (!q) return;
    var walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT, null), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var ql = q.toLowerCase(), count = 0;
    nodes.forEach(function (n) {
      var t = n.nodeValue, lower = t.toLowerCase(); if (lower.indexOf(ql) < 0) return;
      var out = "", i = 0; while (true) { var idx = lower.indexOf(ql, i); if (idx < 0) { out += t.slice(i); break; } out += t.slice(i, idx) + rep; count++; i = idx + q.length; }
      n.nodeValue = out;
    });
    $("find-note").textContent = "Đã thay " + count + " chỗ"; scheduleSave(); updateWC();
  };

  // Đếm từ + tự lưu
  function updateWC() { var t = doc.innerText.trim(); $("wc").textContent = (t ? t.split(/\s+/).length : 0) + " từ"; }
  var saveTimer = null;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { try { localStorage.setItem("vpvie.doc", doc.innerHTML); saveNote.textContent = "Đã lưu"; setTimeout(function () { saveNote.textContent = ""; }, 1500); } catch (e) {} }, 500); }
  doc.addEventListener("input", function () { updateWC(); scheduleSave(); });
  try { var s = localStorage.getItem("vpvie.doc"); if (s) doc.innerHTML = s; } catch (e) {}
  if (!doc.innerHTML.trim()) doc.innerHTML = "<h1>Tiêu đề văn bản</h1><p>Bắt đầu soạn thảo tại đây…</p>";
  updateWC();

  // AI hỗ trợ
  var menu = $("ai-menu"), savedRange = null;
  $("ai-btn").onclick = function (e) {
    e.stopPropagation();
    var sel = window.getSelection(); savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var r = this.getBoundingClientRect(); menu.style.left = r.left + "px"; menu.style.top = (r.bottom + 4) + "px"; menu.classList.toggle("show");
  };
  document.addEventListener("click", function () { menu.classList.remove("show"); });
  menu.addEventListener("click", function (e) { e.stopPropagation(); });
  menu.querySelectorAll("button").forEach(function (b) {
    b.onclick = async function () {
      menu.classList.remove("show");
      var selText = savedRange ? savedRange.toString() : "";
      var text = selText || doc.innerText;
      if (!text.trim()) { alert("Chưa có nội dung."); return; }
      saveNote.textContent = "AI đang xử lý…";
      try {
        var res = await fetch("./api/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ text: text, task: b.dataset.task }, (window.VPLicense ? window.VPLicense.creds() : {}))) });
        var d = await res.json();
        if (!res.ok || !d.ok) throw new Error(d.error || "Lỗi");
        doc.focus();
        if (selText && savedRange) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); document.execCommand("insertText", false, d.text); }
        else { var p = document.createElement("p"); p.textContent = d.text; doc.appendChild(p); }
        updateWC(); scheduleSave(); saveNote.textContent = "";
      } catch (err) { saveNote.textContent = ""; alert(err.message || "Lỗi AI"); }
    };
  });
})();
