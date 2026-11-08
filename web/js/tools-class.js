// Tiện ích lớp học: đồng hồ đếm ngược + gọi tên ngẫu nhiên.
(function (global) {
  "use strict";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function buildTimer(body, data) {
    body.innerHTML = "";
    var total = data.total || 300, remain = total, running = false, iv = null;
    var cap = el("div", "ov-cap"); cap.textContent = "⏱ Đồng hồ đếm ngược";
    var disp = el("div", "cl-time");
    var presets = el("div", "cl-presets");
    [1, 3, 5, 10, 15].forEach(function (m) { var b = el("button"); b.textContent = m + " phút"; b.onclick = function () { total = m * 60; remain = total; data.total = total; stop(); upd(); }; presets.appendChild(b); });
    var custom = el("input"); custom.type = "number"; custom.min = 1; custom.placeholder = "phút"; custom.style.width = "70px";
    custom.onchange = function () { var m = parseInt(this.value, 10); if (m > 0) { total = m * 60; remain = total; data.total = total; stop(); upd(); } };
    var ctrl = el("div", "cl-ctrl");
    var startBtn = el("button", "cl-start"); startBtn.textContent = "Bắt đầu";
    var resetBtn = el("button"); resetBtn.textContent = "Đặt lại";
    ctrl.appendChild(startBtn); ctrl.appendChild(resetBtn);
    [cap, disp, presets, custom, ctrl].forEach(function (x) { body.appendChild(x); });
    function upd() { disp.textContent = pad(Math.floor(remain / 60)) + ":" + pad(remain % 60); disp.classList.toggle("done", remain <= 0); }
    function tick() { remain--; if (remain <= 0) { remain = 0; upd(); stop(); disp.classList.add("flash"); return; } upd(); }
    function start() { if (running || remain <= 0) return; running = true; startBtn.textContent = "Tạm dừng"; iv = setInterval(tick, 1000); }
    function stop() { running = false; startBtn.textContent = "Bắt đầu"; if (iv) { clearInterval(iv); iv = null; } }
    startBtn.onclick = function () { running ? stop() : start(); };
    resetBtn.onclick = function () { remain = total; stop(); disp.classList.remove("flash"); upd(); };
    upd();
  }

  function buildPicker(body, data) {
    body.innerHTML = "";
    var cap = el("div", "ov-cap"); cap.textContent = "🎲 Gọi tên ngẫu nhiên";
    var big = el("div", "cl-name"); big.textContent = "—";
    var btn = el("button", "cl-pick"); btn.textContent = "🎲 Gọi tên";
    var ta = el("textarea", "cl-names"); ta.placeholder = "Mỗi dòng một tên học sinh…"; ta.value = data.names || "";
    ta.oninput = function () { data.names = ta.value; };
    var used = [];
    btn.onclick = function () {
      var names = (ta.value || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!names.length) { big.textContent = "(chưa có tên)"; return; }
      var pool = names.filter(function (n) { return used.indexOf(n) < 0; }); if (!pool.length) { used = []; pool = names; }
      var pick = pool[Math.floor(Math.random() * pool.length)]; used.push(pick);
      big.textContent = pick; big.classList.remove("pop"); void big.offsetWidth; big.classList.add("pop");
    };
    [cap, big, btn, ta].forEach(function (x) { body.appendChild(x); });
  }

  global.VPClass = { buildTimer: buildTimer, buildPicker: buildPicker };
})(window);
