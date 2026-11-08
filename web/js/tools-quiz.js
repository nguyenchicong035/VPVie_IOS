// Khối câu hỏi: trắc nghiệm A/B/C/D và Đúng–Sai, có che/hiện đáp án. Hỗ trợ công thức trong $...$.
(function (global) {
  "use strict";
  function div(c) { var d = document.createElement("div"); d.className = c; return d; }
  function renderMixed(el, text) {
    el.innerHTML = "";
    var parts = (text || "").split(/\$([^$]+)\$/);
    parts.forEach(function (seg, i) {
      if (i % 2 === 1) { var s = document.createElement("span"); try { global.katex.render(seg, s, { throwOnError: false }); } catch (e) { s.textContent = seg; } el.appendChild(s); }
      else if (seg) el.appendChild(document.createTextNode(seg));
    });
  }
  function header(card, no) { var h = div("quiz-head"); h.innerHTML = '<span class="quiz-badge">Câu ' + (no || 1) + "</span>"; card.appendChild(h); }
  function toggleBtn(card, onToggle) {
    var btn = document.createElement("button"); btn.className = "quiz-toggle"; btn.textContent = "👁 Hiện đáp án"; var shown = false;
    btn.onclick = function () { shown = !shown; onToggle(shown); btn.textContent = shown ? "🙈 Ẩn đáp án" : "👁 Hiện đáp án"; };
    card.appendChild(btn);
  }

  function buildMCQ(body, d) {
    body.innerHTML = ""; var card = div("quiz"); header(card, d.no);
    var q = div("quiz-q"); renderMixed(q, d.q); card.appendChild(q);
    var opts = div("quiz-opts"); var L = ["A", "B", "C", "D"];
    d.opts.forEach(function (o, i) {
      if (o === undefined || o === "") return;
      var row = div("quiz-opt"); row.dataset.i = i;
      var b = document.createElement("b"); b.textContent = L[i] + ". ";
      var t = document.createElement("span"); renderMixed(t, o);
      row.appendChild(b); row.appendChild(t); opts.appendChild(row);
    });
    card.appendChild(opts);
    var sol = div("quiz-sol"); sol.style.display = "none";
    if (d.sol) { var sb = document.createElement("b"); sb.textContent = "Lời giải: "; var ss = document.createElement("span"); renderMixed(ss, d.sol); sol.appendChild(sb); sol.appendChild(ss); }
    card.appendChild(sol);
    toggleBtn(card, function (shown) {
      opts.querySelectorAll(".quiz-opt").forEach(function (r) { r.classList.toggle("correct", shown && parseInt(r.dataset.i, 10) === d.correct); });
      sol.style.display = shown && d.sol ? "block" : "none";
    });
    body.appendChild(card);
  }

  function buildTF(body, d) {
    body.innerHTML = ""; var card = div("quiz"); header(card, d.no);
    var q = div("quiz-q"); renderMixed(q, d.q); card.appendChild(q);
    var tbl = document.createElement("table"); tbl.className = "tf";
    tbl.innerHTML = "<thead><tr><th>Mệnh đề</th><th>Đúng</th><th>Sai</th></tr></thead>";
    var tb = document.createElement("tbody"); var L = ["a", "b", "c", "d"];
    d.rows.forEach(function (r, i) {
      if (!r || r.t === undefined || r.t === "") return;
      var tr = document.createElement("tr"); tr.dataset.ans = r.ans;
      var td = document.createElement("td"); var b = document.createElement("b"); b.textContent = L[i] + ") "; var st = document.createElement("span"); renderMixed(st, r.t); td.appendChild(b); td.appendChild(st);
      var c1 = document.createElement("td"); c1.className = "tf-cell"; c1.dataset.v = "true"; c1.innerHTML = '<span class="dot"></span>';
      var c2 = document.createElement("td"); c2.className = "tf-cell"; c2.dataset.v = "false"; c2.innerHTML = '<span class="dot"></span>';
      tr.appendChild(td); tr.appendChild(c1); tr.appendChild(c2); tb.appendChild(tr);
    });
    tbl.appendChild(tb); card.appendChild(tbl);
    toggleBtn(card, function (shown) {
      tb.querySelectorAll("tr").forEach(function (tr) {
        var ans = tr.dataset.ans === "true";
        tr.querySelectorAll(".tf-cell").forEach(function (c) { c.classList.toggle("correct", shown && c.dataset.v === String(ans)); });
      });
    });
    body.appendChild(card);
  }

  global.VPQuiz = { buildMCQ: buildMCQ, buildTF: buildTF };
})(window);
