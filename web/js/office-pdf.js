// VPVie – Xem & ghi chú PDF bằng pdf.js (nguồn mở).
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.min.js";
  var viewer = $("viewer"), doc = null, scale = 1.3, penOn = false;

  $("open").onclick = function () { $("pdf-file").click(); };
  $("pdf-file").onchange = function () { var f = this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { openData(new Uint8Array(rd.result)); $("pdf-note").textContent = f.name; }; rd.readAsArrayBuffer(f); this.value = ""; };

  async function openData(data) {
    try { doc = await pdfjsLib.getDocument({ data: data }).promise; await renderAll(); }
    catch (e) { viewer.innerHTML = '<div class="pdf-empty">Không mở được PDF.</div>'; }
  }
  async function renderAll() {
    if (!doc) return;
    viewer.innerHTML = "";
    for (var i = 1; i <= doc.numPages; i++) {
      var page = await doc.getPage(i);
      var vp = page.getViewport({ scale: scale });
      var wrap = document.createElement("div"); wrap.className = "pdf-page";
      var c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      var oc = document.createElement("canvas"); oc.width = vp.width; oc.height = vp.height; oc.className = "annot";
      wrap.appendChild(c); wrap.appendChild(oc); viewer.appendChild(wrap);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      setupAnnot(oc);
    }
    applyPenMode();
  }
  function setupAnnot(oc) {
    var ctx = oc.getContext("2d"), drawing = false;
    function pos(e) { var r = oc.getBoundingClientRect(); return { x: (e.clientX - r.left) * oc.width / r.width, y: (e.clientY - r.top) * oc.height / r.height }; }
    oc.addEventListener("pointerdown", function (e) { if (!penOn) return; drawing = true; oc.setPointerCapture(e.pointerId); var p = pos(e); ctx.strokeStyle = $("pen-color").value; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(p.x, p.y); });
    oc.addEventListener("pointermove", function (e) { if (!drawing) return; var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
    oc.addEventListener("pointerup", function () { drawing = false; });
  }
  function applyPenMode() { viewer.querySelectorAll("canvas.annot").forEach(function (oc) { oc.style.pointerEvents = penOn ? "auto" : "none"; oc.style.cursor = penOn ? "crosshair" : "default"; }); }

  $("zoom-in").onclick = function () { scale = Math.min(3, scale + 0.2); $("zoom-lv").textContent = Math.round(scale / 1.3 * 100) + "%"; renderAll(); };
  $("zoom-out").onclick = function () { scale = Math.max(0.5, scale - 0.2); $("zoom-lv").textContent = Math.round(scale / 1.3 * 100) + "%"; renderAll(); };
  $("pen").onclick = function () { penOn = !penOn; this.classList.toggle("on", penOn); applyPenMode(); };
  $("clear-annot").onclick = function () { viewer.querySelectorAll("canvas.annot").forEach(function (oc) { oc.getContext("2d").clearRect(0, 0, oc.width, oc.height); }); };
  $("print").onclick = function () { window.print(); };

  window.__pdf = { openData: openData };
})();
