// Bảng cửu chương tương tác cho VPVie: lưới 10x10, bấm ô để hiện tích + tô sáng hàng/cột.
(function (global) {
  "use strict";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function build(body, data) {
    body.innerHTML = "";
    data.show = !!data.show; data.revealed = data.revealed || {};
    var N = 10, save = data._save || function () { };
    var head = el("div", "mt-head");
    var ttl = el("div", "mt-title"); ttl.textContent = "Bảng cửu chương";
    var toggle = el("button", "mt-toggle");
    head.appendChild(ttl); head.appendChild(toggle);
    var tbl = el("table", "mt-tbl");
    body.appendChild(head); body.appendChild(tbl);

    function render() {
      toggle.textContent = data.show ? "Ẩn đáp án" : "Hiện tất cả";
      tbl.innerHTML = "";
      for (var r = 0; r <= N; r++) {
        var tr = el("tr");
        for (var c = 0; c <= N; c++) {
          if (r === 0 && c === 0) { var th0 = el("td", "mt-corner"); th0.textContent = "×"; tr.appendChild(th0); continue; }
          if (r === 0 || c === 0) { var h = el("td", "mt-hdr"); h.textContent = (r === 0 ? c : r); h.dataset.rc = (r === 0 ? "c" : "r") + (r === 0 ? c : r); tr.appendChild(h); continue; }
          (function (rr, cc) {
            var td = el("td", "mt-cell"); var key = rr + "x" + cc;
            var shown = data.show || data.revealed[key];
            td.textContent = shown ? (rr * cc) : "?";
            if (shown) td.classList.add("on");
            td.onclick = function (e) {
              e.stopPropagation();
              if (!data.show) { data.revealed[key] = !data.revealed[key]; }
              render(); highlight(rr, cc); save();
            };
            td.dataset.r = rr; td.dataset.c = cc;
            tr.appendChild(td);
          })(r, c);
        }
        tbl.appendChild(tr);
      }
    }
    function highlight(r, c) {
      tbl.querySelectorAll(".hl").forEach(function (x) { x.classList.remove("hl"); });
      tbl.querySelectorAll('.mt-cell[data-r="' + r + '"],.mt-cell[data-c="' + c + '"]').forEach(function (x) {
        if (x.dataset.r === String(r) && x.dataset.c === String(c)) x.classList.add("hl");
      });
      tbl.querySelectorAll(".mt-hdr").forEach(function (h) { h.classList.toggle("hl", h.textContent === String(r) || h.textContent === String(c)); });
    }
    toggle.onclick = function () { data.show = !data.show; render(); save(); };
    tbl.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    render();
  }
  global.VPMultab = { build: build };
})(window);
