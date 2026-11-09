// Editable transparent tables with independent, persisted row/column dimensions.
(function (global) {
  'use strict';
  function size(value, fallback, min) { return Number.isFinite(value) ? Math.max(min, Math.min(2000, value)) : fallback; }
  function columnName(index) { var name = ''; for (index++; index; index = Math.floor((index - 1) / 26)) name = String.fromCharCode(65 + (index - 1) % 26) + name; return name; }
  function build(body, data, save) {
    var wrap = document.createElement('div'); wrap.className = 'table-wrap';
    var table = document.createElement('table'); table.className = 'ov-table';
    var cols = document.createElement('colgroup'), rows = [], columns = [], colHeaders = [], rowHeaders = [];
    var headers = document.createElement('div'); headers.className = 'table-headers'; headers.setAttribute('data-html2canvas-ignore', 'true');
    data.cells = data.cells || []; data.colWidths = data.colWidths || []; data.rowHeights = data.rowHeights || [];
    for (var c = 0; c < data.cols; c++) {
      data.colWidths[c] = size(data.colWidths[c], 80, 24);
      var col = document.createElement('col'); cols.appendChild(col); columns.push(col);
    }
    table.appendChild(cols);
    var tbody = document.createElement('tbody'); table.appendChild(tbody);
    for (var r = 0; r < data.rows; r++) {
      data.rowHeights[r] = size(data.rowHeights[r], 32, 20); data.cells[r] = data.cells[r] || [];
      var tr = document.createElement('tr'), cells = [];
      for (var j = 0; j < data.cols; j++) {
        var td = document.createElement('td'), cell = document.createElement('div');
        cell.className = 'table-cell'; cell.contentEditable = 'true'; cell.spellcheck = false;
        cell.setAttribute('aria-label', columnName(j) + (r + 1)); cell.textContent = data.cells[r][j] || '';
        (function (rr, cc, edit) { edit.addEventListener('input', function () { data.cells[rr][cc] = edit.textContent; save(); }); })(r, j, cell);
        td.appendChild(cell); tr.appendChild(td); cells.push(cell);
      }
      tbody.appendChild(tr); rows.push(cells);
    }
    function layout() {
      var x = 0, y = 0;
      columns.forEach(function (col, i) { col.style.width = data.colWidths[i] + 'px'; colHeaders[i].style.left = x + 'px'; colHeaders[i].style.width = data.colWidths[i] + 'px'; x += data.colWidths[i]; });
      table.style.width = x + 'px';
      rows.forEach(function (cells, i) { cells.forEach(function (cell) { cell.style.height = data.rowHeights[i] + 'px'; }); rowHeaders[i].style.top = y + 'px'; rowHeaders[i].style.height = data.rowHeights[i] + 'px'; y += data.rowHeights[i]; });
      rows.forEach(function (cells, i) { var tr = cells[0] && cells[0].parentNode.parentNode; if (table.isConnected && tr) { rowHeaders[i].style.top = tr.offsetTop + 'px'; rowHeaders[i].style.height = tr.offsetHeight + 'px'; } });
      if (table.isConnected && rows[0]) rows[0].forEach(function (cell, i) { var td = cell.parentNode; colHeaders[i].style.left = td.offsetLeft + 'px'; colHeaders[i].style.width = td.offsetWidth + 'px'; });
      colHeaders.forEach(function (h, i) { h.lastChild.setAttribute('aria-valuenow', Math.round(data.colWidths[i])); });
      rowHeaders.forEach(function (h, i) { h.lastChild.setAttribute('aria-valuenow', Math.round(data.rowHeights[i])); });
    }
    function header(axis, index, label) {
      var h = document.createElement('div'); h.className = 'table-' + axis + '-header'; h.textContent = label;
      h.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      var grip = document.createElement('span'); grip.className = 'table-' + axis + '-resize'; grip.tabIndex = 0;
      grip.setAttribute('role', 'separator'); grip.setAttribute('aria-orientation', axis === 'col' ? 'vertical' : 'horizontal');
      grip.setAttribute('aria-label', axis === 'col' ? 'Độ rộng cột ' + label : 'Chiều cao hàng ' + label);
      grip.title = grip.getAttribute('aria-label') + ': kéo để chỉnh, hoặc dùng phím mũi tên';
      grip.setAttribute('aria-valuemin', axis === 'col' ? 24 : 20); grip.setAttribute('aria-valuemax', 2000);
      var start = null, values = axis === 'col' ? data.colWidths : data.rowHeights, min = axis === 'col' ? 24 : 20;
      grip.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
        var host = body.closest('.ov'); if (host) host.classList.add('sel');
        start = { pointer: e.pointerId, position: axis === 'col' ? e.clientX : e.clientY, value: values[index], scale: table.getBoundingClientRect().width / table.offsetWidth || 1 };
        grip.setPointerCapture(e.pointerId);
      });
      grip.addEventListener('pointermove', function (e) {
        if (!start || e.pointerId !== start.pointer) return;
        var delta = (axis === 'col' ? e.clientX : e.clientY) - start.position;
        values[index] = size(Math.round(start.value + delta / start.scale), start.value, min); layout();
      });
      function finish() { if (!start) return; start = null; save(); }
      grip.addEventListener('pointerup', finish); grip.addEventListener('pointercancel', finish); grip.addEventListener('lostpointercapture', finish);
      grip.addEventListener('keydown', function (e) {
        var delta = axis === 'col' ? ({ArrowLeft:-1, ArrowRight:1})[e.key] : ({ArrowUp:-1, ArrowDown:1})[e.key];
        if (!delta) return; e.preventDefault(); e.stopPropagation(); values[index] = size(values[index] + delta * (e.shiftKey ? 1 : 10), values[index], min); layout(); save();
      });
      h.appendChild(grip); headers.appendChild(h); return h;
    }
    columns.forEach(function (_, i) { colHeaders.push(header('col', i, columnName(i))); });
    rows.forEach(function (_, i) { rowHeaders.push(header('row', i, String(i + 1))); });
    wrap.appendChild(table); wrap.appendChild(headers); body.appendChild(wrap); layout();
    requestAnimationFrame(function () { if (table.isConnected) layout(); });
  }
  global.VPTable = { build: build };
})(window);
