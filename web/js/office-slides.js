// VPVie – Trình chiếu: soạn slide + tạo slide bằng AI + chiếu + xuất PDF.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var slides = [], cur = 0;
  try { var sv = localStorage.getItem("vpvie.slides"); if (sv) slides = JSON.parse(sv); } catch (e) {}
  if (!slides.length) slides = [{ title: "Tiêu đề bài giảng", bullets: ["Giáo viên: …", "Lớp: …"] }];

  var t = null; function save() { clearTimeout(t); t = setTimeout(function () { try { localStorage.setItem("vpvie.slides", JSON.stringify(slides)); } catch (e) {} }, 400); }

  function esc(x) { return (x || "").replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function slideHTML(s, big) {
    var b = (s.bullets || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    return '<div class="s-title">' + esc(s.title) + '</div><div class="s-body"><ul>' + b + "</ul></div>";
  }
  function renderThumbs() {
    var h = "";
    slides.forEach(function (s, i) { h += '<div class="thumb' + (i === cur ? " cur" : "") + '" data-i="' + i + '"><span class="tn">' + (i + 1) + '</span><div class="tbox">' + slideHTML(s) + "</div></div>"; });
    $("thumbs").innerHTML = h;
    $("thumbs").querySelectorAll(".thumb").forEach(function (el) { el.onclick = function () { cur = +el.dataset.i; renderAll(); }; });
  }
  function renderEditor() {
    var s = slides[cur];
    var box = $("slide");
    box.innerHTML = '<div class="s-title" contenteditable="true" id="e-title">' + esc(s.title) + '</div><div class="s-body"><ul contenteditable="true" id="e-body">' + (s.bullets.length ? s.bullets.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") : "<li></li>") + "</ul></div>";
    $("e-title").addEventListener("input", function () { s.title = this.textContent; renderThumbs(); save(); });
    $("e-body").addEventListener("input", function () { s.bullets = Array.prototype.map.call(this.querySelectorAll("li"), function (li) { return li.textContent; }).filter(function (x, i, a) { return x !== "" || a.length === 1; }); renderThumbs(); save(); });
  }
  function renderAll() { renderThumbs(); renderEditor(); $("pos").textContent = "Slide " + (cur + 1) + "/" + slides.length; }

  $("add-slide").onclick = function () { slides.splice(cur + 1, 0, { title: "Slide mới", bullets: [""] }); cur++; renderAll(); save(); };
  $("del-slide").onclick = function () { if (slides.length <= 1) { slides = [{ title: "Slide", bullets: [""] }]; cur = 0; } else { slides.splice(cur, 1); if (cur >= slides.length) cur = slides.length - 1; } renderAll(); save(); };

  // Trình chiếu
  var pc = 0;
  function showPresent(i) { pc = Math.max(0, Math.min(slides.length - 1, i)); $("present-slide").innerHTML = slideHTML(slides[pc]); }
  $("present").onclick = function () { pc = cur; showPresent(pc); $("present-overlay").classList.add("show"); };
  function closePresent() { $("present-overlay").classList.remove("show"); }
  $("present-overlay").addEventListener("click", function (e) { if (e.target.id === "present-slide" || e.target.closest(".present-slide")) showPresent(pc + 1); });
  document.addEventListener("keydown", function (e) {
    if (!$("present-overlay").classList.contains("show")) return;
    if (e.key === "ArrowRight" || e.key === " ") showPresent(pc + 1);
    else if (e.key === "ArrowLeft") showPresent(pc - 1);
    else if (e.key === "Escape") closePresent();
  });

  // PDF (in tất cả slide)
  $("pdf").onclick = function () {
    $("print-all").innerHTML = slides.map(function (s) { return '<div class="print-slide">' + slideHTML(s) + "</div>"; }).join("");
    window.print();
  };

  // Tạo slide bằng AI
  $("ai-slides").onclick = function () { $("dlg-ai").classList.add("show"); $("ai-topic").focus(); };
  $("ai-cancel").onclick = function () { $("dlg-ai").classList.remove("show"); };
  $("ai-gen").onclick = async function () {
    var topic = $("ai-topic").value.trim(); if (!topic) return;
    var n = parseInt($("ai-n").value, 10) || 6;
    this.disabled = true; this.textContent = "Đang tạo…";
    try {
      var res = await fetch("./api/slides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ topic: topic, n: n }, (window.VPLicense ? window.VPLicense.creds() : {}))) });
      var d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Lỗi");
      if (d.slides && d.slides.length) { slides = d.slides.map(function (s) { return { title: s.title || "", bullets: s.bullets || [] }; }); cur = 0; renderAll(); save(); $("dlg-ai").classList.remove("show"); }
      else throw new Error("AI không trả về slide.");
    } catch (err) { alert(err.message || "Lỗi tạo slide"); }
    finally { this.disabled = false; this.textContent = "Tạo slide"; }
  };

  renderAll();
})();
