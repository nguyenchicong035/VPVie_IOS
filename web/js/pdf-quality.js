// Keep original PDFs in IndexedDB and render the visible page at display density.
(function (global) {
  'use strict';
  var database, pending = new Map(), documents = new Map(), wanted = '', generation = 0, timer, task, result;
  function db() {
    if (!database) database = new Promise(function (resolve, reject) {
      var request = indexedDB.open('vpvie-documents', 1);
      request.onupgradeneeded = function () { request.result.createObjectStore('pdf'); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return database;
  }
  async function put(id, blob) {
    var connection = await db();
    await new Promise(function (resolve, reject) {
      var tx = connection.transaction('pdf', 'readwrite'); tx.objectStore('pdf').put(blob, id);
      tx.oncomplete = resolve; tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Không lưu được PDF gốc')); };
    });
  }
  async function source(id) {
    if (pending.has(id)) await pending.get(id);
    var connection = await db();
    return new Promise(function (resolve, reject) {
      var request = connection.transaction('pdf').objectStore('pdf').get(id);
      request.onsuccess = function () { request.result ? resolve(request.result) : reject(new Error('Thiếu PDF gốc. Hãy nhập lại tệp PDF.')); };
      request.onerror = function () { reject(request.error); };
    });
  }
  async function fingerprint(bytes) {
    var digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return 'pdf-' + Array.from(digest, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  async function store(file) {
    var bytes = await file.arrayBuffer(), id = await fingerprint(bytes);
    await put(id, new Blob([bytes], { type: 'application/pdf' })); return id;
  }
  async function restoreOne(id, blob) {
    if (await fingerprint(await blob.arrayBuffer()) !== id) throw new Error('PDF gốc trong sổ bị hỏng hoặc sai mã kiểm tra');
    await put(id, blob);
  }
  function fromDataUrl(url) {
    if (!/^data:application\/pdf;base64,/.test(url)) throw new Error('Nguồn PDF không hợp lệ');
    var binary = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(binary.length);
    for (var i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'application/pdf' });
  }
  function restore(sources) {
    return Promise.all(Object.keys(sources || {}).map(function (id) {
      var saved = sources[id]; if (!saved.dataUrl) return;
      var promise = restoreOne(id, fromDataUrl(saved.dataUrl)); pending.set(id, promise);
      return promise.finally(function () { pending.delete(id); });
    }));
  }
  function dataUrl(blob) { return new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = function () { reject(r.error); }; r.readAsDataURL(blob); }); }
  async function portable(json) {
    var book = JSON.parse(json), sources = {};
    for (var page of book.pages || []) {
      var ref = page.pdf; if (!ref || sources[ref.documentId]) continue;
      sources[ref.documentId] = { name: ref.name || '', dataUrl: await dataUrl(await source(ref.documentId)) };
    }
    if (Object.keys(sources).length) book.pdfSources = sources;
    return JSON.stringify(book);
  }
  function bounded(width, height) { return Math.min(1, 8192 / Math.max(width, height), Math.sqrt(12000000 / (width * height))); }
  async function documentFor(id) {
    if (!documents.has(id)) {
      if (documents.size >= 2) { var oldest = documents.keys().next().value; documents.get(oldest).then(function (d) { return d.destroy(); }).catch(function () {}); documents.delete(oldest); }
      var promise = source(id).then(function (blob) { return blob.arrayBuffer(); }).then(function (bytes) {
        global.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.js', document.baseURI).href;
        return global.pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
      });
      documents.set(id, promise); promise.catch(function () { if (documents.get(id) === promise) documents.delete(id); });
    }
    return documents.get(id);
  }
  function request(ref, width, height, density, ready) {
    if (ref && (!(width > 0) || !(height > 24))) return null;
    if (!ref) {
      if (wanted) { wanted = ''; generation++; clearTimeout(timer); if (task) task.cancel(); if (result) result.canvas.width = result.canvas.height = 0; result = null; }
      return null;
    }
    var identity = ref.documentId + ':' + ref.pageNumber, key = identity + ':' + width + ':' + height + ':' + Math.round(density * 100);
    if (wanted !== key) {
      wanted = key; var ticket = ++generation; clearTimeout(timer); if (task) task.cancel();
      timer = setTimeout(async function () {
        var canvas;
        try {
          var doc = await documentFor(ref.documentId); if (ticket !== generation) return;
          var page = await doc.getPage(ref.pageNumber); if (ticket !== generation) return;
          var unit = page.getViewport({ scale: 1 }), scale = Math.min(width / unit.width, Math.max(1, height - 24) / unit.height) * density;
          scale *= bounded(unit.width * scale, unit.height * scale);
          var viewport = page.getViewport({ scale: scale });
          canvas = document.createElement('canvas'); canvas.dataset.pdfPage = 'true'; canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          var rendering = page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }); task = rendering;
          await rendering.promise; if (task === rendering) task = null;
          if (ticket !== generation) { canvas.width = canvas.height = 0; return; }
          var previous = result; result = { identity: identity, canvas: canvas, key: key };
          if (previous) previous.canvas.width = previous.canvas.height = 0;
          ready();
        } catch (error) {
          if (canvas) canvas.width = canvas.height = 0;
          if (ticket === generation && error.name !== 'RenderingCancelledException') console.warn('Không vẽ lại được PDF:', error.message);
        }
      }, 180);
    }
    return result && result.identity === identity ? result.canvas : null;
  }
  global.VPPdfQuality = { store: store, restore: restore, portable: portable, request: request, bounded: bounded };
})(window);
