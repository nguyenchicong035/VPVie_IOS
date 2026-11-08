// Thước kẻ / đo góc ảo: kéo để di chuyển, nút quay để xoay (hiện số đo góc), nút phải để đổi độ dài.
(function (global) {
  "use strict";
  var el = null;

  function make(board) {
    var r = document.createElement("div");
    r.className = "nr-ruler";
    var W = 760, H = 86;
    r.style.left = "120px"; r.style.top = "90px"; r.style.width = W + "px";
    r.dataset.ang = "0"; r.dataset.w = W;
    r.innerHTML =
      '<div class="rl-body" style="width:' + W + 'px;height:' + H + 'px">' +
      '<canvas class="rl-ticks" width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="rl-ang">0°</div>' +
      '<button class="rl-rot" title="Kéo để xoay">⟳</button>' +
      '<button class="rl-size" title="Kéo để đổi độ dài">⟷</button>' +
      '<button class="rl-close" title="Bỏ thước">✕</button>' +
      '</div>';
    board.appendChild(r);
    drawTicks(r);
    wire(r, board);
    return r;
  }

  function drawTicks(r) {
    var cv = r.querySelector(".rl-ticks"), c = cv.getContext("2d"), W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H); c.strokeStyle = "#39434d"; c.fillStyle = "#39434d"; c.lineWidth = 1;
    c.font = "11px 'Segoe UI'"; c.textAlign = "center";
    var per = 40; // px mỗi cm
    for (var mm = 0, x = 16; x < W - 16; mm++, x = 16 + mm * (per / 10)) {
      var cm = mm % 10 === 0, half = mm % 5 === 0;
      var len = cm ? 20 : (half ? 13 : 7);
      c.beginPath(); c.moveTo(x + 0.5, 8); c.lineTo(x + 0.5, 8 + len); c.stroke();
      if (cm) c.fillText(String(mm / 10), x, 42);
    }
  }

  function setAngle(r, ang) {
    r.dataset.ang = ang.toFixed(0);
    r.style.transform = "rotate(" + ang + "deg)";
    r.querySelector(".rl-ang").textContent = ang.toFixed(0) + "°";
  }

  function wire(r, board) {
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
    rot.addEventListener("pointerdown", function (e) {
      e.stopPropagation(); rot.setPointerCapture(e.pointerId);
      var rc = r.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
      function mv(ev) { var a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI; setAngle(r, a); }
      function up() { rot.removeEventListener("pointermove", mv); rot.removeEventListener("pointerup", up); }
      rot.addEventListener("pointermove", mv); rot.addEventListener("pointerup", up);
    });
    // Đổi độ dài
    var sz = r.querySelector(".rl-size");
    sz.addEventListener("pointerdown", function (e) {
      e.stopPropagation(); sz.setPointerCapture(e.pointerId);
      var sx = e.clientX, w0 = parseFloat(r.dataset.w);
      function mv(ev) {
        var w = Math.max(260, Math.min(1400, w0 + (ev.clientX - sx)));
        r.dataset.w = w; r.style.width = w + "px"; body.style.width = w + "px";
        var cv = r.querySelector(".rl-ticks"); cv.width = w; drawTicks(r);
      }
      function up() { sz.removeEventListener("pointermove", mv); sz.removeEventListener("pointerup", up); }
      sz.addEventListener("pointermove", mv); sz.addEventListener("pointerup", up);
    });
    r.querySelector(".rl-close").onclick = function () { remove(); };
  }

  function remove() { if (el && el.parentNode) el.parentNode.removeChild(el); el = null; }

  global.VPRuler = {
    toggle: function (board) { if (el) { remove(); return false; } el = make(board); return true; },
    active: function () { return !!el; }
  };
})(window);
