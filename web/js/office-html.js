(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var src = $("src"), prev = $("prev"), note = $("save-note");
  function render() { prev.srcdoc = src.value; }
  var t = null; function save() { clearTimeout(t); t = setTimeout(function () { try { localStorage.setItem("vpvie.html", src.value); note.textContent = "Đã lưu"; setTimeout(function(){note.textContent="";},1200); } catch (e) {} }, 400); }
  src.addEventListener("input", function () { render(); save(); });
  try { var s = localStorage.getItem("vpvie.html"); if (s) src.value = s; } catch (e) {}
  if (!src.value) src.value = "<!doctype html>\n<h1 style='color:#1F3D55'>Xin chào VPVie</h1>\n<p>Soạn <b>HTML</b> và xem trước ngay.</p>";
  render();
  $("dl").onclick = function () { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([src.value], { type: "text/html" })); a.download = "trang.html"; a.click(); };
})();
