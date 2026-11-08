// Bảng chữ cái tiếng Việt tương tác cho VPVie: bấm chữ -> hiện to (hoa + thường).
(function (global) {
  "use strict";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  var LETTERS = ["a", "ă", "â", "b", "c", "d", "đ", "e", "ê", "g", "h", "i", "k", "l", "m", "n", "o", "ô", "ơ", "p", "q", "r", "s", "t", "u", "ư", "v", "x", "y"];
  function build(body, data) {
    body.innerHTML = "";
    data.sel = data.sel || "a"; data.upper = !!data.upper;
    var save = data._save || function () { };
    var head = el("div", "al-head");
    var ttl = el("div", "al-title"); ttl.textContent = "Bảng chữ cái";
    var toggle = el("button", "al-toggle");
    head.appendChild(ttl); head.appendChild(toggle);
    var big = el("div", "al-big");
    var grid = el("div", "al-grid");
    body.appendChild(head); body.appendChild(big); body.appendChild(grid);

    function showBig() {
      var c = data.sel; big.innerHTML = "";
      var up = el("span", "al-up"); up.textContent = c.toUpperCase();
      var lo = el("span", "al-lo"); lo.textContent = c;
      if (data.upper) { big.appendChild(up); big.appendChild(lo); } else { big.appendChild(lo); big.appendChild(up); }
    }
    function render() {
      toggle.textContent = data.upper ? "Hoa trước" : "Thường trước";
      showBig();
      grid.innerHTML = "";
      LETTERS.forEach(function (c) {
        var b = el("button", "al-cell" + (c === data.sel ? " on" : ""));
        b.textContent = data.upper ? c.toUpperCase() : c;
        b.onclick = function (e) { e.stopPropagation(); data.sel = c; render(); save(); };
        grid.appendChild(b);
      });
    }
    toggle.onclick = function () { data.upper = !data.upper; render(); save(); };
    grid.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    render();
  }
  global.VPAlpha = { build: build };
})(window);
