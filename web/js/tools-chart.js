// Biểu đồ số liệu (cột / tròn / đường) cho VPVie.
(function (global) {
  "use strict";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  var PAL = ["#2f6fe4", "#1a9e52", "#e8a13a", "#d6453c", "#7a46c9", "#0e9aa7", "#d6336c", "#5b8c00", "#e8630a", "#3aa0d6"];

  function parseData(raw) {
    return String(raw || "").split("\n").map(function (ln) {
      var m = ln.split(/[,\t;]/); if (m.length < 2) return null;
      var v = parseFloat(String(m[m.length - 1]).replace(/[^0-9.\-]/g, ""));
      if (isNaN(v)) return null; return { label: m.slice(0, m.length - 1).join(",").trim(), value: v };
    }).filter(Boolean);
  }

  function build(body, data) {
    body.innerHTML = "";
    data.type = data.type || "bar";
    if (data.raw == null) data.raw = "Toán, 8\nVăn, 6\nAnh, 9\nLý, 7";
    var save = data._save || function () { };
    var head = el("div", "ch-head");
    var title = el("div", "ch-title"); title.contentEditable = "true"; title.spellcheck = false; title.textContent = data.title || "Biểu đồ";
    title.addEventListener("input", function () { data.title = title.textContent; save(); });
    title.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    var seg = el("div", "ch-seg");
    [["bar", "Cột"], ["pie", "Tròn"], ["line", "Đường"]].forEach(function (o) {
      var b = el("button"); b.textContent = o[1]; if (o[0] === data.type) b.classList.add("on");
      b.onclick = function () { data.type = o[0]; seg.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); render(); save(); };
      seg.appendChild(b);
    });
    head.appendChild(title); head.appendChild(seg);
    var cv = el("canvas", "ch-canvas"); cv.width = 380; cv.height = 240;
    var ta = el("textarea", "ch-data"); ta.value = data.raw; ta.placeholder = "Mỗi dòng: Nhãn, Giá trị\nVD: Toán, 8";
    ta.addEventListener("input", function () { data.raw = ta.value; render(); save(); });
    [head, cv, ta].forEach(function (x) { body.appendChild(x); });

    function render() {
      var rows = parseData(data.raw), ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H); ctx.textBaseline = "alphabetic";
      if (!rows.length) { ctx.fillStyle = "#98a1ae"; ctx.font = "14px 'Segoe UI'"; ctx.textAlign = "center"; ctx.fillText("Nhập số liệu bên dưới…", W / 2, H / 2); return; }
      if (data.type === "pie") drawPie(ctx, W, H, rows);
      else drawAxis(ctx, W, H, rows, data.type);
    }
    function drawAxis(ctx, W, H, rows, type) {
      var padL = 34, padB = 30, padT = 14, padR = 12;
      var max = Math.max.apply(0, rows.map(function (r) { return r.value; })); if (max <= 0) max = 1;
      var x0 = padL, y0 = H - padB, plotW = W - padL - padR, plotH = H - padB - padT;
      ctx.strokeStyle = "#cdd3dc"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, padT); ctx.lineTo(x0, y0); ctx.lineTo(W - padR, y0); ctx.stroke();
      ctx.fillStyle = "#98a1ae"; ctx.font = "10px 'Segoe UI'"; ctx.textAlign = "right";
      for (var g = 0; g <= 4; g++) { var gv = max * g / 4, gy = y0 - plotH * g / 4; ctx.strokeStyle = "#eef1f5"; ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(W - padR, gy); ctx.stroke(); ctx.fillStyle = "#98a1ae"; ctx.fillText(String(Math.round(gv * 10) / 10), x0 - 4, gy + 3); }
      var n = rows.length, slot = plotW / n;
      if (type === "line") {
        ctx.strokeStyle = PAL[0]; ctx.lineWidth = 2.4; ctx.beginPath();
        rows.forEach(function (r, i) { var px = x0 + slot * (i + 0.5), py = y0 - plotH * (r.value / max); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
        rows.forEach(function (r, i) { var px = x0 + slot * (i + 0.5), py = y0 - plotH * (r.value / max); ctx.fillStyle = PAL[0]; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 6.2832); ctx.fill(); ctx.fillStyle = "#1f2733"; ctx.font = "10px 'Segoe UI'"; ctx.textAlign = "center"; ctx.fillText(String(r.value), px, py - 7); });
      } else {
        rows.forEach(function (r, i) { var bw = slot * 0.6, px = x0 + slot * i + (slot - bw) / 2, bh = plotH * (r.value / max), py = y0 - bh; ctx.fillStyle = PAL[i % PAL.length]; ctx.fillRect(px, py, bw, bh); ctx.fillStyle = "#1f2733"; ctx.font = "10px 'Segoe UI'"; ctx.textAlign = "center"; ctx.fillText(String(r.value), px + bw / 2, py - 4); });
      }
      ctx.fillStyle = "#51606c"; ctx.font = "11px 'Segoe UI'"; ctx.textAlign = "center";
      rows.forEach(function (r, i) { var cxl = x0 + slot * (i + 0.5); ctx.fillText(r.label.slice(0, 8), cxl, y0 + 13); });
    }
    function drawPie(ctx, W, H, rows) {
      var total = rows.reduce(function (s, r) { return s + Math.max(0, r.value); }, 0) || 1;
      var cx = H / 2 + 6, cy = H / 2 + 4, R = H / 2 - 18, a = -Math.PI / 2;
      rows.forEach(function (r, i) { var ang = (Math.max(0, r.value) / total) * 6.2832; ctx.fillStyle = PAL[i % PAL.length]; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a, a + ang); ctx.closePath(); ctx.fill(); if (ang > 0.25) { var mid = a + ang / 2; ctx.fillStyle = "#fff"; ctx.font = "bold 11px 'Segoe UI'"; ctx.textAlign = "center"; ctx.fillText(Math.round(r.value / total * 100) + "%", cx + Math.cos(mid) * R * 0.62, cy + Math.sin(mid) * R * 0.62 + 3); } a += ang; });
      var lx = cx + R + 16, ly = 22;
      rows.forEach(function (r, i) { ctx.fillStyle = PAL[i % PAL.length]; ctx.fillRect(lx, ly - 9, 12, 12); ctx.fillStyle = "#1f2733"; ctx.font = "11px 'Segoe UI'"; ctx.textAlign = "left"; ctx.fillText(r.label.slice(0, 10) + " (" + r.value + ")", lx + 17, ly + 1); ly += 18; });
    }
    render();
  }

  global.VPChart = { build: build, parseData: parseData };
})(window);
