// Zoom/pan a complete page, keeping document coordinates independent of the view.
(function (global) {
  'use strict';
  function create(board, options) {
    var surface = document.createElement('div'); surface.id = 'page-surface'; surface.className = 'page-surface';
    while (board.firstChild) surface.appendChild(board.firstChild);
    board.appendChild(surface);
    var recordingFrame = surface.querySelector("#rec-region"); if (recordingFrame) board.appendChild(recordingFrame);
    var zoom = 1, x = 0, y = 0, touches = new Map(), pinch = null, pan = null, blocked = false, replaying = false, snapshot = null, quietUntil = 0, lastZoom = 1;
    var minus = document.getElementById('page-zoom-out'), plus = document.getElementById('page-zoom-in'), label = document.getElementById('page-zoom-reset');
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function paint() {
      var w = board.clientWidth, h = board.clientHeight;
      x = zoom <= 1 ? (w - w * zoom) / 2 : clamp(x, w - w * zoom, 0);
      y = zoom <= 1 ? (h - h * zoom) / 2 : clamp(y, h - h * zoom, 0);
      board.classList.toggle("page-zoomed", zoom !== 1);
      surface.style.width = w + 'px'; surface.style.height = h + 'px';
      surface.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + zoom + ')';
      label.textContent = Math.round(zoom * 100) + '%'; label.setAttribute('aria-label', 'Thu phóng ' + Math.round(zoom * 100) + ' phần trăm; bấm để về 100%');
      minus.disabled = zoom <= .25; plus.disabled = zoom >= 4;
      if (lastZoom !== zoom) { lastZoom = zoom; if (options.onZoom) options.onZoom(zoom); }
    }
    function point(clientX, clientY) { var r = surface.getBoundingClientRect(); return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom }; }
    function zoomTo(value, cx, cy) {
      var r = board.getBoundingClientRect(), ax = cx == null ? r.width / 2 : cx - r.left, ay = cy == null ? r.height / 2 : cy - r.top;
      var next = clamp(value, .25, 4); x = ax - (ax - x) * next / zoom; y = ay - (ay - y) * next / zoom; zoom = next; paint();
    }
    function stop(e) { e.preventDefault(); e.stopImmediatePropagation(); }
    function capture(id) { try { board.setPointerCapture(id); } catch (_) {} }
    function cancelPending() {
      replaying = true;
      touches.forEach(function (p, id) {
        p.target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: id, pointerType: 'touch', clientX: p.x, clientY: p.y }));
        try { if (p.target.hasPointerCapture(id)) p.target.releasePointerCapture(id); } catch (_) {}
      });
      replaying = false; options.cancel(snapshot);
    }
    function geometry() {
      var p = Array.from(touches.values()).slice(0, 2), cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
      return { cx: cx, cy: cy, distance: Math.max(1, Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)) };
    }
    board.addEventListener('pointerdown', function (e) {
      if (replaying) return;
      if (e.pointerType === 'touch' && options.touchAllowed(e)) {
        if (!touches.size) snapshot = options.snapshot();
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY, target: e.target });
        if (touches.size >= 2) {
          if (!blocked) cancelPending();
          blocked = true; pan = null; var g = geometry(), r = board.getBoundingClientRect();
          pinch = { distance: g.distance, zoom: zoom, anchorX: (g.cx - r.left - x) / zoom, anchorY: (g.cy - r.top - y) / zoom };
          touches.forEach(function (_, id) { capture(id); }); stop(e); return;
        }
      }
      if (options.isPan() && e.button === 0 && !e.target.closest('button,input,textarea,[contenteditable]')) {
        pan = { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: x, y: y }; capture(e.pointerId); stop(e);
      }
    }, true);
    board.addEventListener('pointermove', function (e) {
      if (replaying) return;
      if (touches.has(e.pointerId)) { var p = touches.get(e.pointerId); p.x = e.clientX; p.y = e.clientY; }
      if (blocked) {
        if (pinch && touches.size >= 2) { var g = geometry(), r = board.getBoundingClientRect(); zoom = clamp(pinch.zoom * g.distance / pinch.distance, .25, 4); x = g.cx - r.left - pinch.anchorX * zoom; y = g.cy - r.top - pinch.anchorY * zoom; paint(); }
        stop(e); return;
      }
      if (pan && e.pointerId === pan.id) { x = pan.x + e.clientX - pan.cx; y = pan.y + e.clientY - pan.cy; paint(); stop(e); }
    }, true);
    function end(e) {
      if (replaying) return;
      var handled = blocked || (pan && pan.id === e.pointerId);
      touches.delete(e.pointerId); if (pan && pan.id === e.pointerId) pan = null;
      if (touches.size < 2) pinch = null;
      if (!touches.size) { blocked = false; snapshot = null; }
      if (handled) { quietUntil = Date.now() + 300; stop(e); }
    }
    board.addEventListener('pointerup', end, true); board.addEventListener('pointercancel', end, true);
    board.addEventListener('pointerleave', function (e) { if (blocked && !replaying) e.stopImmediatePropagation(); }, true);
    board.addEventListener('click', function (e) { if (Date.now() < quietUntil) stop(e); }, true);
    board.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomTo(zoom * Math.exp(-e.deltaY * .002), e.clientX, e.clientY); }
      else if (zoom > 1 && !e.target.closest('input,textarea,[contenteditable],.ov-web')) { e.preventDefault(); x -= e.deltaX || (e.shiftKey ? e.deltaY : 0); y -= e.shiftKey ? 0 : e.deltaY; paint(); }
    }, { passive: false });
    // Safari's gesture events must not zoom the browser chrome on top of page zoom.
    ['gesturestart','gesturechange','gestureend'].forEach(function (name) { board.addEventListener(name, function (e) { e.preventDefault(); }, { passive: false }); });
    minus.onclick = function () { zoomTo(zoom / 1.25); }; plus.onclick = function () { zoomTo(zoom * 1.25); };
    label.onclick = function () { zoom = 1; x = y = 0; paint(); };
    paint();
    return { surface: surface, point: point, zoomTo: zoomTo, resize: paint, getState: function () { return { zoom: zoom, x: x, y: y }; } };
  }
  global.VPPageViewport = { create: create };
})(window);
