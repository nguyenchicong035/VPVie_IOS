// Bản đồ tư duy (mindmap) cho VPVie: nút trung tâm + nhánh, kéo-thả, sửa chữ, tự nối.
(function (global) {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";
  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function uid() { return "n" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  var PAL = ["#1F6FEB", "#1A7F37", "#E3A008", "#C21807", "#7A3FB3", "#0E7490", "#D6336C", "#2B8A3E"];

  function build(body, data) {
    body.innerHTML = "";
    data.w = data.w || 480; data.h = data.h || 340;
    if (!data.nodes || !data.nodes.length) data.nodes = [{ id: uid(), text: "Chủ đề chính", x: data.w / 2, y: data.h / 2, parent: null, color: "#7a1020" }];
    var save = data._save || function () { };
    var mm = el("div", "mm"); mm.style.width = data.w + "px"; mm.style.height = data.h + "px";
    var svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("class", "mm-links"); svg.setAttribute("width", data.w); svg.setAttribute("height", data.h);
    mm.appendChild(svg); body.appendChild(mm);

    function byId(id) { for (var i = 0; i < data.nodes.length; i++) if (data.nodes[i].id === id) return data.nodes[i]; return null; }
    function childCount(id) { return data.nodes.filter(function (n) { return n.parent === id; }).length; }
    function clampX(x) { return Math.max(20, Math.min(data.w - 20, x)); }
    function clampY(y) { return Math.max(16, Math.min(data.h - 16, y)); }
    function addChild(parent) {
      var root = byId(parent.id).parent === null;
      var color = root ? PAL[childCount(parent.id) % PAL.length] : parent.color;
      var k = childCount(parent.id), ang = (root ? (k * 0.9 - 1.2) : ((Math.random() - 0.5) * 1.4));
      var nx = clampX(parent.x + Math.cos(ang) * 110 + 40), ny = clampY(parent.y + Math.sin(ang) * 90);
      data.nodes.push({ id: uid(), text: "Ý mới", x: nx, y: ny, parent: parent.id, color: color });
      render(); save();
    }
    function removeNode(n) {
      var kill = {}; (function mark(id) { kill[id] = 1; data.nodes.forEach(function (c) { if (c.parent === id) mark(c.id); }); })(n.id);
      data.nodes = data.nodes.filter(function (c) { return !kill[c.id]; }); render(); save();
    }
    function linkPath(p, c) {
      var mx = (p.x + c.x) / 2; return "M" + p.x + " " + p.y + " C" + mx + " " + p.y + "," + mx + " " + c.y + "," + c.x + " " + c.y;
    }
    function render() {
      Array.prototype.slice.call(mm.querySelectorAll(".mm-node")).forEach(function (d) { d.remove(); });
      svg.innerHTML = "";
      data.nodes.forEach(function (n) {
        if (n.parent == null) return; var p = byId(n.parent); if (!p) return;
        var path = document.createElementNS(SVGNS, "path"); path.setAttribute("d", linkPath(p, n)); path.setAttribute("fill", "none"); path.setAttribute("stroke", n.color); path.setAttribute("stroke-width", "3"); path.setAttribute("stroke-linecap", "round"); svg.appendChild(path);
      });
      data.nodes.forEach(function (n) {
        var root = n.parent == null;
        var d = el("div", "mm-node" + (root ? " root" : "")); d.style.left = n.x + "px"; d.style.top = n.y + "px"; d.style.setProperty("--c", n.color);
        var txt = el("div", "mm-txt"); txt.contentEditable = "true"; txt.spellcheck = false; txt.textContent = n.text;
        txt.addEventListener("input", function () { n.text = txt.textContent; save(); });
        txt.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
        var add = el("button", "mm-add"); add.textContent = "+"; add.title = "Thêm nhánh"; add.onmousedown = function (e) { e.stopPropagation(); }; add.onclick = function (e) { e.stopPropagation(); addChild(n); };
        d.appendChild(txt); d.appendChild(add);
        if (!root) { var del = el("button", "mm-del"); del.textContent = "×"; del.title = "Xóa nhánh"; del.onmousedown = function (e) { e.stopPropagation(); }; del.onclick = function (e) { e.stopPropagation(); removeNode(n); }; d.appendChild(del); }
        dragNode(d, n);
        mm.appendChild(d);
      });
    }
    function dragNode(d, n) {
      d.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button") || e.target.closest(".mm-txt")) return;
        e.stopPropagation(); e.preventDefault();
        var sx = e.clientX, sy = e.clientY, ox = n.x, oy = n.y, moved = false;
        d.setPointerCapture(e.pointerId);
        function mv(ev) { n.x = clampX(ox + (ev.clientX - sx) / (global.VPViewport ? global.VPViewport.getState().zoom : 1)); n.y = clampY(oy + (ev.clientY - sy) / (global.VPViewport ? global.VPViewport.getState().zoom : 1)); moved = true; d.style.left = n.x + "px"; d.style.top = n.y + "px"; relink(); }
        function up() { d.removeEventListener("pointermove", mv); d.removeEventListener("pointerup", up); if (moved) save(); }
        d.addEventListener("pointermove", mv); d.addEventListener("pointerup", up);
      });
    }
    function relink() {
      var paths = svg.querySelectorAll("path"), i = 0;
      data.nodes.forEach(function (n) { if (n.parent == null) return; var p = byId(n.parent); if (!p) return; var pa = paths[i++]; if (pa) pa.setAttribute("d", linkPath(p, n)); });
    }
    render();
  }

  global.VPMindmap = { build: build };
})(window);
