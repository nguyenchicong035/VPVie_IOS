// Trò chơi câu đố (quiz) + Ô chữ bí mật cho VPVie.
// Định dạng file câu đố (mỗi câu cách nhau bằng dòng trống hoặc ---):
//   Câu hỏi?
//   *Đáp án đúng        (dấu * ở đầu = đáp án đúng)
//   Đáp án sai
//   @Giải thích...      (tuỳ chọn)
//   #20                 (thời gian giây, tuỳ chọn)
(function (global) {
  "use strict";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }

  // ---- Lưu nhiều bộ câu đố ----
  function load() {
    try { var c = JSON.parse(localStorage.getItem("vpvie.quizzes") || "null"); if (c && c.list) return c; } catch (e) {}
    return { current: "", list: {} };
  }
  var QZ = load();
  function save() { try { localStorage.setItem("vpvie.quizzes", JSON.stringify(QZ)); } catch (e) {} }
  function names() { return Object.keys(QZ.list); }
  function current() { return QZ.current; }
  function getRaw(nm) { return (QZ.list[nm] && QZ.list[nm].raw) || ""; }
  function setQuiz(nm, raw) { nm = (nm || "").trim(); if (!nm) return false; QZ.list[nm] = { raw: raw || "" }; QZ.current = nm; save(); return true; }
  function renameQuiz(o, n) { n = (n || "").trim(); if (!QZ.list[o] || !n) return false; if (n !== o && QZ.list[n]) return false; QZ.list[n] = QZ.list[o]; if (n !== o) delete QZ.list[o]; if (QZ.current === o) QZ.current = n; save(); return true; }
  function del(nm) { delete QZ.list[nm]; var ks = names(); QZ.current = ks[0] || ""; save(); }
  function select(nm) { if (QZ.list[nm]) { QZ.current = nm; save(); } }

  // ---- Phân tích file câu đố ----
  function parse(text) {
    var blocks = String(text || "").replace(/\r/g, "").replace(/\n[ \t]*-{3,}[ \t]*\n/g, "\n\n").split(/\n[ \t]*\n/);
    var qs = [];
    blocks.forEach(function (blk) {
      var lines = blk.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (lines.length < 2) return;
      var q = { q: lines[0], opts: [], correct: 0, explain: "", time: 0, key: 0 };
      for (var i = 1; i < lines.length; i++) {
        var ln = lines[i];
        if (ln[0] === "@") q.explain = ln.slice(1).trim();
        else if (ln[0] === "#") q.time = parseInt(ln.slice(1), 10) || 0;
        else if (ln[0] === "^") q.key = (parseInt(ln.slice(1), 10) || 1) - 1;
        else { var ok = ln[0] === "*"; var t = ok ? ln.slice(1).trim() : ln; if (ok) q.correct = q.opts.length; q.opts.push(t); }
      }
      if (q.q && q.opts.length) qs.push(q);
    });
    return qs;
  }

  var THEMES = ["candy", "rainbow", "ocean", "space", "jungle"];
  function applyTheme(body, data) {
    var host = body.closest(".ov"); if (!host) return;
    THEMES.forEach(function (t) { host.classList.remove("qz-th-" + t); });
    data.theme = data.theme || "candy"; host.classList.add("qz-th-" + data.theme);
  }
  function themeBtn(body, data) {
    var b = el("button", "qz-theme-btn"); b.textContent = "🎨"; b.title = "Đổi nền";
    b.onclick = function () { var i = THEMES.indexOf(data.theme || "candy"); data.theme = THEMES[(i + 1) % THEMES.length]; applyTheme(body, data); };
    return b;
  }

  // ---- Trình chơi câu đố ----
  function buildPlayer(body, data) {
    body.innerHTML = "";
    var qs = data.questions || parse(data.raw || "");
    data.questions = qs;
    var idx = data.idx || 0, answered = false, timer = null;
    var head = el("div", "qz-head");
    var title = el("div", "qz-title"); title.textContent = data.title || "Câu đố";
    var prog = el("div", "qz-prog");
    head.appendChild(title); head.appendChild(prog); head.appendChild(themeBtn(body, data));
    applyTheme(body, data);
    var tbar = el("div", "qz-timer"); var tfill = el("div", "qz-timer-fill"); tbar.appendChild(tfill);
    var qtext = el("div", "qz-q");
    var opts = el("div", "qz-opts");
    var explain = el("div", "qz-explain"); explain.hidden = true;
    var next = el("button", "qz-next"); next.textContent = "Câu tiếp ▶"; next.hidden = true;
    [head, tbar, qtext, opts, explain, next].forEach(function (x) { body.appendChild(x); });
    var LET = ["A", "B", "C", "D", "E", "F"];

    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function reveal(correctBtn) {
      answered = true; stopTimer();
      Array.prototype.forEach.call(opts.children, function (b, i) { b.classList.add("done"); if (i === qs[idx].correct) b.classList.add("correct"); b.disabled = true; });
      if (qs[idx].explain) { explain.textContent = "💡 " + qs[idx].explain; explain.hidden = false; }
      next.hidden = false; next.textContent = (idx >= qs.length - 1) ? "🏁 Kết thúc" : "Câu tiếp ▶";
    }
    function renderQ() {
      answered = false; explain.hidden = true; next.hidden = true; stopTimer();
      if (!qs.length) { qtext.textContent = "(Chưa có câu hỏi. Hãy Soạn câu đố.)"; prog.textContent = ""; opts.innerHTML = ""; tbar.style.display = "none"; return; }
      if (idx >= qs.length) { showDone(); return; }
      data.idx = idx;
      var q = qs[idx]; prog.textContent = "Câu " + (idx + 1) + "/" + qs.length;
      qtext.textContent = q.q; opts.innerHTML = "";
      q.opts.forEach(function (t, i) {
        var b = el("button", "qz-opt");
        b.innerHTML = '<span class="qz-let">' + (LET[i] || (i + 1)) + '</span><span class="qz-txt"></span>';
        b.querySelector(".qz-txt").textContent = t;
        b.onclick = function () {
          if (answered || b.classList.contains("off")) return;
          if (i === q.correct) { b.classList.add("correct", "front"); Array.prototype.forEach.call(opts.children, function (o) { if (o !== b) o.classList.add("dim"); }); reveal(b); }
          else { b.classList.add("wrong"); setTimeout(function () { b.classList.remove("wrong"); b.classList.add("off"); }, 700); }
        };
        opts.appendChild(b);
      });
      // Đếm giờ nếu có
      if (q.time > 0) {
        tbar.style.display = "block"; var total = q.time, left = total;
        tfill.style.transition = "none"; tfill.style.width = "100%";
        void tfill.offsetWidth; tfill.style.transition = "width 1s linear"; tfill.style.width = "0%";
        timer = setInterval(function () { left--; if (left <= 0) { stopTimer(); if (!answered) { var cb = opts.children[q.correct]; if (cb) cb.classList.add("front"); reveal(cb); } } }, 1000);
      } else tbar.style.display = "none";
    }
    function showDone() {
      stopTimer(); prog.textContent = ""; tbar.style.display = "none"; opts.innerHTML = ""; explain.hidden = true;
      qtext.innerHTML = ""; var d = el("div", "qz-done"); d.innerHTML = "🎉 Hoàn thành " + qs.length + " câu!"; qtext.appendChild(d);
      next.hidden = false; next.textContent = "↻ Chơi lại";
    }
    next.onclick = function () {
      if (idx >= qs.length - 1 && answered) { if (next.textContent.indexOf("lại") >= 0) { idx = 0; renderQ(); } else { idx = qs.length; showDone(); } return; }
      if (next.textContent.indexOf("lại") >= 0) { idx = 0; renderQ(); return; }
      idx++; renderQ();
    };
    renderQ();
  }

  // ---- Ô chữ bí mật (điền từ) ----
  function buildCrossword(body, data) {
    body.innerHTML = "";
    var qs = data.questions || parse(data.raw || "");
    var head = el("div", "qz-head");
    var ht = el("div", "qz-title"); ht.textContent = data.title || "Ô chữ bí mật";
    head.appendChild(ht); head.appendChild(themeBtn(body, data));
    body.appendChild(head); applyTheme(body, data);
    var wrap = el("div", "cw-wrap"); body.appendChild(wrap);
    var secret = el("div", "cw-secret"); secret.textContent = ""; body.appendChild(secret);
    var rows = qs.map(function (q) { var ans = (q.opts[q.correct] || "").toUpperCase().replace(/\s/g, ""); return { clue: q.q, ans: ans, key: Math.min(q.key || 0, Math.max(0, ans.length - 1)), done: false }; }).filter(function (r) { return r.ans; });
    function render() {
      wrap.innerHTML = "";
      rows.forEach(function (r, ri) {
        var row = el("div", "cw-row");
        var btn = el("button", "cw-clue"); btn.textContent = (ri + 1) + ". " + r.clue;
        btn.onclick = function () { r.done = !r.done; render(); };
        var cells = el("div", "cw-cells");
        for (var i = 0; i < r.ans.length; i++) {
          var c = el("div", "cw-cell" + (i === r.key ? " key" : ""));
          c.textContent = r.done ? r.ans[i] : "";
          cells.appendChild(c);
        }
        row.appendChild(btn); row.appendChild(cells); wrap.appendChild(row);
      });
      var sw = rows.map(function (r) { return r.done ? (r.ans[r.key] || "") : "·"; }).join("");
      secret.innerHTML = 'Từ khóa: <b>' + sw + '</b>';
    }
    render();
  }

  global.VPQuiz2 = {
    parse: parse, buildPlayer: buildPlayer, buildCrossword: buildCrossword,
    names: names, current: current, getRaw: getRaw, setQuiz: setQuiz, renameQuiz: renameQuiz, del: del, select: select
  };
})(window);
