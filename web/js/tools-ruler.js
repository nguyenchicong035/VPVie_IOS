// Bộ dụng cụ ảo: thước thẳng, êke, thước đo góc, compa.
// Mỗi dụng cụ là một widget kéo-thả + xoay được, dùng làm vật chuẩn để vẽ theo.
(function (global) {
  "use strict";
  var el = null, elKind = null;
  var PX = 40; // px mỗi cm

  function remove() { if (el && el.parentNode) el.parentNode.removeChild(el); el = null; elKind = null; }

  function common(r, board, opts) {
    var body = r.querySelector(".rl-body");
    // Di chuyển
    body.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".rl-rot,.rl-size,.rl-close")) return;
      var sx = e.clientX, sy = e.clientY, ox = parseFloat(r.style.left), oy = parseFloat(r.style.top);
      body.setPointerCapture(e.pointerId);
      function mv(ev) { r.style.left = (ox + ev.clientX - sx) + "px"; r.style.top = (oy + ev.clientY - sy) + "px"; }
      function up() { body.removeEventListener("pointermove", mv); body.removeEventListener("pointerup", up); }
      body.addEventListener("pointermove", mv); body.addEventListener("pointerup", up);
    });
    // Xoay
    var rot = r.querySelector(".rl-rot");
    if (rot) rot.addEventListener("pointerdown", function (e) {
      e.stopPropagation(); rot.setPointerCapture(e.pointerId);
      var rc = r.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
      function mv(ev) { var a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI; r.dataset.ang = a.toFixed(0); r.style.transform = "rotate(" + a + "deg)"; var am = r.querySelector(".rl-ang"); if (am) am.textContent = a.toFixed(0) + "°"; }
      function up() { rot.removeEventListener("pointermove", mv); rot.removeEventListener("pointerup", up); }
      rot.addEventListener("pointermove", mv); rot.addEventListener("pointerup", up);
    });
    // Đổi kích thước (tuỳ dụng cụ)
    var sz = r.querySelector(".rl-size");
    if (sz && opts && opts.onResize) sz.addEventListener("pointerdown", function (e) {
      e.stopPropagation(); sz.setPointerCapture(e.pointerId); var sx = e.clientX, sy = e.clientY;
      function mv(ev) { opts.onResize(ev.clientX - sx, ev.clientY - sy); }
      function up() { sz.removeEventListener("pointermove", mv); sz.removeEventListener("pointerup", up); }
      sz.addEventListener("pointermove", mv); sz.addEventListener("pointerup", up);
    });
    var cl = r.querySelector(".rl-close"); if (cl) cl.onclick = function () { remove(); };
  }

  // ----- Thước thẳng -----
  function makeRuler(board) {
    var r = document.createElement("div"); r.className = "nr-ruler"; var W = 760, H = 86;
    r.style.left = "120px"; r.style.top = "90px"; r.dataset.ang = "0"; r.dataset.w = W;
    r.innerHTML = '<div class="rl-body" style="width:' + W + 'px;height:' + H + 'px">' +
      '<canvas class="rl-ticks" width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="rl-ang">0°</div><button class="rl-rot" title="Kéo để xoay">⟳</button>' +
      '<button class="rl-size" title="Kéo để đổi độ dài">⟷</button><button class="rl-close" title="Bỏ">✕</button></div>';
    board.appendChild(r); drawRulerTicks(r);
    common(r, board, { onResize: function (dx) { var w = Math.max(260, Math.min(1400, parseFloat(r.dataset.w) + dx)); r.dataset.w = w; var b = r.querySelector(".rl-body"); b.style.width = w + "px"; var cv = r.querySelector(".rl-ticks"); cv.width = w; drawRulerTicks(r); } });
    r.dataset.w = W; return r;
  }
  function drawRulerTicks(r) {
    var cv = r.querySelector(".rl-ticks"), c = cv.getContext("2d"), W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H); c.strokeStyle = "#39434d"; c.fillStyle = "#39434d"; c.lineWidth = 1; c.font = "11px 'Segoe UI'"; c.textAlign = "center";
    for (var mm = 0, x = 16; x < W - 16; mm++, x = 16 + mm * (PX / 10)) {
      var cm = mm % 10 === 0, half = mm % 5 === 0, len = cm ? 20 : (half ? 13 : 7);
      c.beginPath(); c.moveTo(x + 0.5, 8); c.lineTo(x + 0.5, 8 + len); c.stroke();
      if (cm) c.fillText(String(mm / 10), x, 42);
    }
  }

  // ----- Thước đo góc (nửa đường tròn) -----
  function makeProtractor(board) {
    var R = 150, W = 2 * R, H = R + 20;
    var r = document.createElement("div"); r.className = "nr-ruler nr-proto"; r.style.left = "160px"; r.style.top = "120px"; r.dataset.ang = "0";
    r.innerHTML = '<div class="rl-body" style="width:' + W + 'px;height:' + H + 'px">' +
      '<canvas class="rl-ticks" width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="rl-ang">0°</div><button class="rl-rot" title="Kéo để xoay">⟳</button><button class="rl-close" title="Bỏ">✕</button></div>';
    board.appendChild(r); drawProtractor(r.querySelector(".rl-ticks"), R); common(r, board, {}); return r;
  }
  function drawProtractor(cv, R) {
    var c = cv.getContext("2d"), cx = R, cy = R, rr = R - 8; c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = "rgba(228,239,250,.6)"; c.beginPath(); c.arc(cx, cy, rr, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = "#2f3842"; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, rr, Math.PI, 0); c.moveTo(cx - rr, cy); c.lineTo(cx + rr, cy); c.stroke();
    c.fillStyle = "#2f3842"; c.strokeStyle = "#2f3842";
    for (var d = 0; d <= 180; d++) {
      var a = d * Math.PI / 180, big = d % 10 === 0, mid = d % 5 === 0, len = big ? 13 : (mid ? 9 : 5);
      var x1 = cx - Math.cos(a) * rr, y1 = cy - Math.sin(a) * rr, x2 = cx - Math.cos(a) * (rr - len), y2 = cy - Math.sin(a) * (rr - len);
      c.lineWidth = big ? 1.3 : 0.8; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      if (big) { c.font = "10px 'Segoe UI'"; c.textAlign = "center"; var tx = cx - Math.cos(a) * (rr - 24), ty = cy - Math.sin(a) * (rr - 24); c.fillText(String(d), tx, ty + 3); }
    }
    c.beginPath(); c.arc(cx, cy, 3, 0, 6.2832); c.fill();
  }

  // ----- Êke (tam giác vuông 30-60-90) -----
  function makeSquare(board) {
    var W = 300, H = 190;
    var r = document.createElement("div"); r.className = "nr-ruler nr-square"; r.style.left = "160px"; r.style.top = "120px"; r.dataset.ang = "0";
    r.innerHTML = '<div class="rl-body" style="width:' + W + 'px;height:' + H + 'px">' +
      '<canvas class="rl-ticks" width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="rl-ang">0°</div><button class="rl-rot" title="Kéo để xoay">⟳</button><button class="rl-close" title="Bỏ">✕</button></div>';
    board.appendChild(r); drawSquare(r.querySelector(".rl-ticks")); common(r, board, {}); return r;
  }
  function drawSquare(cv) {
    var c = cv.getContext("2d"), W = cv.width, H = cv.height, m = 12;
    c.clearRect(0, 0, W, H);
    c.fillStyle = "rgba(228,239,250,.6)"; c.beginPath(); c.moveTo(m, H - m); c.lineTo(W - m, H - m); c.lineTo(m, m); c.closePath(); c.fill();
    c.strokeStyle = "#2f3842"; c.lineWidth = 1.6; c.stroke();
    c.strokeRect(m, H - m - 16, 16, 16); // dấu góc vuông
    c.strokeStyle = "#2f3842"; c.fillStyle = "#2f3842"; c.lineWidth = 1; c.font = "10px 'Segoe UI'"; c.textAlign = "center";
    for (var mm = 0, x = m; x < W - m; mm++, x = m + mm * (PX / 10)) { var cm = mm % 10 === 0, half = mm % 5 === 0, len = cm ? 14 : (half ? 9 : 5); c.beginPath(); c.moveTo(x, H - m); c.lineTo(x, H - m - len); c.stroke(); if (cm && mm) c.fillText(String(mm / 10), x, H - m - 18); } // cạnh đáy
    for (var nn = 0, y = H - m; y > m; nn++, y = H - m - nn * (PX / 10)) { var cm2 = nn % 10 === 0, half2 = nn % 5 === 0, len2 = cm2 ? 14 : (half2 ? 9 : 5); c.beginPath(); c.moveTo(m, y); c.lineTo(m + len2, y); c.stroke(); } // cạnh đứng
    c.font = "bold 12px 'Segoe UI'"; c.fillText("90°", m + 24, H - m - 6); c.fillText("30°", W - m - 30, H - m - 8); c.fillText("60°", m + 16, m + 26);
  }

  // ----- Compa (vòng tròn chuẩn để vẽ theo) -----
  function makeCompass(board) {
    var R = 110, pad = 30, S = 2 * (R + pad);
    var r = document.createElement("div"); r.className = "nr-ruler nr-compass"; r.style.left = "180px"; r.style.top = "120px"; r.dataset.r = R;
    r.innerHTML = '<div class="rl-body" style="width:' + S + 'px;height:' + S + 'px">' +
      '<canvas class="rl-ticks" width="' + S + '" height="' + S + '"></canvas>' +
      '<button class="rl-size" title="Kéo để đổi bán kính">⟷</button><button class="rl-close" title="Bỏ">✕</button></div>';
    board.appendChild(r); drawCompass(r.querySelector(".rl-ticks"), R);
    common(r, board, { onResize: function (dx, dy) { var R2 = Math.max(30, Math.min(230, parseFloat(r.dataset.r) + (dx + dy) / 2)); r.dataset.r = R2; drawCompass(r.querySelector(".rl-ticks"), R2); positionSize(r, R2); } });
    positionSize(r, R); return r;
  }
  function positionSize(r, R) { var s = r.querySelector(".rl-size"); var cv = r.querySelector(".rl-ticks"); if (s) { s.style.left = (cv.width / 2 + R - 10) + "px"; s.style.top = (cv.height / 2 - 10) + "px"; } }
  function drawCompass(cv, R) {
    var c = cv.getContext("2d"), cx = cv.width / 2, cy = cv.height / 2; c.clearRect(0, 0, cv.width, cv.height);
    c.strokeStyle = "#7a1020"; c.lineWidth = 2; c.setLineDash([7, 5]); c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke(); c.setLineDash([]);
    c.strokeStyle = "#39434d"; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 7, cy); c.lineTo(cx + 7, cy); c.moveTo(cx, cy - 7); c.lineTo(cx, cy + 7); c.stroke();
    c.fillStyle = "#7a1020"; c.font = "bold 12px 'Segoe UI'"; c.textAlign = "center"; c.fillText("R ≈ " + (Math.round(R / PX * 10) / 10) + " cm", cx, cy - 10);
  }

  var MK = { ruler: makeRuler, proto: makeProtractor, round: makeProtractor, square: makeSquare, parabol: makeRuler, compass: makeCompass };
  global.VPRuler = {
    toggle: function (board) { return this.show(board, "ruler"); },
    show: function (board, kind) {
      kind = kind || "ruler";
      if (el && elKind === kind) { remove(); return false; }
      remove(); el = (MK[kind] || makeRuler)(board); elKind = kind; return true;
    },
    hide: function () { remove(); elKind = null; },
    active: function () { return !!el; }, kind: function () { return elKind; }
  };
})(window);
