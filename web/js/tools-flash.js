// Flashcard từ vựng cho VPVie: bộ thẻ lật (mặt trước | mặt sau), lật/chuyển/xáo.
(function (global) {
  "use strict";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function parse(raw) {
    return String(raw || "").split("\n").map(function (ln) {
      var m = ln.split(/\s*[|=\t]\s*/); if (m.length < 2 || !m[0].trim()) return null;
      return { a: m[0].trim(), b: m.slice(1).join(" ").trim() };
    }).filter(Boolean);
  }
  function build(body, data) {
    body.innerHTML = "";
    if (data.raw == null) data.raw = "apple | quả táo\nbook | quyển sách\nschool | trường học";
    var save = data._save || function () { };
    var cards = parse(data.raw), idx = Math.min(data.idx || 0, Math.max(0, cards.length - 1));
    var head = el("div", "fc-head");
    var ttl = el("div", "fc-title"); ttl.textContent = "Thẻ từ vựng";
    var editBtn = el("button", "fc-mini"); editBtn.textContent = "✎"; editBtn.title = "Sửa danh sách thẻ";
    head.appendChild(ttl); head.appendChild(editBtn);
    var card = el("div", "fc-card"); var inner = el("div", "fc-inner");
    var face = el("div", "fc-face fc-front"); var back = el("div", "fc-face fc-back");
    inner.appendChild(face); inner.appendChild(back); card.appendChild(inner);
    var nav = el("div", "fc-nav");
    var prev = el("button", "fc-nb"); prev.textContent = "◀";
    var cnt = el("span", "fc-cnt");
    var next = el("button", "fc-nb"); next.textContent = "▶";
    var shuf = el("button", "fc-nb"); shuf.textContent = "🔀";
    nav.appendChild(prev); nav.appendChild(cnt); nav.appendChild(next); nav.appendChild(shuf);
    var ta = el("textarea", "fc-data"); ta.hidden = true; ta.value = data.raw; ta.placeholder = "Mỗi dòng: mặt trước | mặt sau\nVD: apple | quả táo";
    [head, card, nav, ta].forEach(function (x) { body.appendChild(x); });

    function render() {
      cards = parse(data.raw); if (!cards.length) { face.textContent = "(chưa có thẻ)"; back.textContent = ""; cnt.textContent = "0/0"; return; }
      if (idx >= cards.length) idx = 0; data.idx = idx;
      card.classList.remove("flip");
      face.textContent = cards[idx].a; back.textContent = cards[idx].b;
      cnt.textContent = (idx + 1) + "/" + cards.length;
    }
    card.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    card.addEventListener("click", function () { card.classList.toggle("flip"); });
    prev.onclick = function (e) { e.stopPropagation(); idx = (idx - 1 + cards.length) % cards.length; render(); save(); };
    next.onclick = function (e) { e.stopPropagation(); idx = (idx + 1) % cards.length; render(); save(); };
    shuf.onclick = function (e) { e.stopPropagation(); for (var i = cards.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = cards[i]; cards[i] = cards[j]; cards[j] = t; } data.raw = cards.map(function (c) { return c.a + " | " + c.b; }).join("\n"); ta.value = data.raw; idx = 0; render(); save(); };
    editBtn.onclick = function () { ta.hidden = !ta.hidden; };
    ta.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    ta.addEventListener("input", function () { data.raw = ta.value; render(); save(); });
    render();
  }
  global.VPFlash = { build: build, parse: parse };
})(window);
