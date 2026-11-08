// Chèn video cho VPVie: file cục bộ, link trực tiếp hoặc YouTube; cắt đoạn (start/end).
(function (global) {
  "use strict";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function ytId(u) {
    if (!u) return null;
    var m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }
  function parseTime(s) {
    s = String(s || "").trim(); if (!s) return 0;
    if (/^\d+:\d{1,2}$/.test(s)) { var a = s.split(":"); return parseInt(a[0], 10) * 60 + parseInt(a[1], 10); }
    var v = parseFloat(s); return isNaN(v) ? 0 : v;
  }
  function build(body, data) {
    body.innerHTML = "";
    var save = data._save || function () { };
    var head = el("div", "vd-head");
    var ttl = el("div", "vd-title"); ttl.textContent = "Video";
    var editBtn = el("button", "vd-mini"); editBtn.textContent = "✎"; editBtn.title = "Đổi video";
    head.appendChild(ttl); head.appendChild(editBtn);
    var stage = el("div", "vd-stage");
    body.appendChild(head); body.appendChild(stage);
    editBtn.onclick = function () { data._editing = true; render(); };

    function render() {
      stage.innerHTML = "";
      var yt = data.kind === "youtube" ? ytId(data.src) : null;
      if (data._editing || (!data.src && data.kind !== "file") || (data.kind === "file" && !data._blobUrl)) { form(); return; }
      if (data.kind === "youtube" && yt) {
        var s = Math.round(parseTime(data.start)), e = Math.round(parseTime(data.end));
        var q = "?rel=0&modestbranding=1" + (s ? "&start=" + s : "") + (e ? "&end=" + e : "");
        var fr = el("iframe", "vd-frame"); fr.src = "https://www.youtube.com/embed/" + yt + q;
        fr.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
        fr.setAttribute("allowfullscreen", ""); fr.setAttribute("frameborder", "0");
        stage.appendChild(fr);
      } else {
        var v = el("video", "vd-video"); v.controls = true; v.playsInline = true;
        v.src = (data.kind === "file") ? data._blobUrl : data.src;
        var s2 = parseTime(data.start), e2 = parseTime(data.end);
        v.addEventListener("loadedmetadata", function () { if (s2) try { v.currentTime = s2; } catch (x) {} });
        if (e2 > 0) v.addEventListener("timeupdate", function () { if (v.currentTime >= e2) { v.pause(); try { v.currentTime = s2 || 0; } catch (x) {} } });
        stage.appendChild(v);
        if (data.kind === "file" && !data._blobUrl) { var note = el("div", "vd-note"); note.textContent = "Video cục bộ chỉ phát trong phiên này; hãy chọn lại file sau khi mở lại sổ."; stage.appendChild(note); }
      }
    }
    function form() {
      stage.innerHTML = "";
      var f = el("div", "vd-form");
      var lab = el("div", "vd-lab"); lab.textContent = "Dán link video hoặc YouTube:";
      var inp = el("input", "vd-inp"); inp.placeholder = "https://… hoặc https://youtu.be/…"; inp.value = (data.kind !== "file" && data.src) ? data.src : "";
      var row = el("div", "vd-row");
      var useBtn = el("button", "vd-btn"); useBtn.textContent = "Dùng link";
      var fileBtn = el("button", "vd-btn ghost"); fileBtn.textContent = "📂 Chọn file…";
      row.appendChild(useBtn); row.appendChild(fileBtn);
      var trim = el("div", "vd-trim");
      var ts = el("input", "vd-tin"); ts.placeholder = "Bắt đầu (vd 0:30)"; ts.value = data.start || "";
      var te = el("input", "vd-tin"); te.placeholder = "Kết thúc (vd 1:20)"; te.value = data.end || "";
      trim.appendChild(ts); trim.appendChild(te);
      f.appendChild(lab); f.appendChild(inp); f.appendChild(trim); f.appendChild(row);
      stage.appendChild(f);
      [inp, ts, te].forEach(function (x) { x.addEventListener("pointerdown", function (e) { e.stopPropagation(); }); });
      useBtn.onclick = function () {
        var u = inp.value.trim(); if (!u) return;
        data.src = u; data.kind = ytId(u) ? "youtube" : "url"; data.start = ts.value.trim(); data.end = te.value.trim();
        data._editing = false; delete data._blobUrl; render(); save();
      };
      fileBtn.onclick = function () {
        var fi = document.createElement("input"); fi.type = "file"; fi.accept = "video/*";
        fi.onchange = function () { var file = fi.files[0]; if (!file) return; data.kind = "file"; data.src = file.name; data.start = ts.value.trim(); data.end = te.value.trim(); data._blobUrl = URL.createObjectURL(file); data._editing = false; render(); save(); };
        fi.click();
      };
    }
    render();
  }
  global.VPVideo = { build: build, ytId: ytId };
})(window);
