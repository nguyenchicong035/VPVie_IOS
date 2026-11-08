// Đăng nhập Google + đồng bộ Google Drive (chuẩn Google Identity Services, quyền drive.file).
// Không cần client secret. Client ID do người dùng tạo & dán vào (không phải bí mật).
// Sổ được lưu thành 1 tệp JSON trong Drive của chính người dùng; app chỉ thấy tệp nó tạo.
(function (global) {
  "use strict";
  var CID_KEY = "vpvie.gdrive.clientId", FID_KEY = "vpvie.gdrive.fileId", FNAME = "so-bai-giang.vpvie.json";
  var SCOPE = "https://www.googleapis.com/auth/drive.file";
  var token = null, clientId = null;

  function ls(get, k, v) { try { return get ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return get ? "" : null; } }
  function getClientId() { return clientId || ls(true, CID_KEY) || ""; }
  function setClientId(id) { clientId = (id || "").trim(); ls(false, CID_KEY, clientId); }

  function loadGis() {
    return new Promise(function (res, rej) {
      if (global.google && global.google.accounts && global.google.accounts.oauth2) return res();
      var s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error("Không tải được Google Identity Services (cần kết nối mạng tới Google).")); };
      document.head.appendChild(s);
    });
  }

  // Lấy access token (mở cửa sổ đăng nhập/đồng ý của Google khi cần)
  async function ensureToken(interactive) {
    clientId = getClientId();
    if (!clientId) { var e = new Error("NO_CLIENT_ID"); e.code = "NO_CLIENT_ID"; throw e; }
    await loadGis();
    return new Promise(function (res, rej) {
      var tc = global.google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: SCOPE,
        callback: function (resp) { if (resp && resp.access_token) { token = resp.access_token; res(token); } else rej(new Error("Không lấy được quyền truy cập Drive.")); },
        error_callback: function (err) { rej(new Error((err && err.type) ? ("Đăng nhập Google: " + err.type) : "Lỗi đăng nhập Google.")); }
      });
      tc.requestAccessToken({ prompt: interactive ? "consent" : "" });
    });
  }

  function api(url, opts) { opts = opts || {}; opts.headers = Object.assign({ Authorization: "Bearer " + token }, opts.headers || {}); return fetch(url, opts); }

  async function findFile() {
    var fid = ls(true, FID_KEY);
    if (fid) { var chk = await api("https://www.googleapis.com/drive/v3/files/" + fid + "?fields=id,trashed"); if (chk.ok) { var cj = await chk.json(); if (cj.id && !cj.trashed) return fid; } }
    var q = encodeURIComponent("name='" + FNAME + "' and trashed=false");
    var r = await api("https://www.googleapis.com/drive/v3/files?q=" + q + "&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc");
    var d = await r.json();
    if (d.files && d.files.length) { ls(false, FID_KEY, d.files[0].id); return d.files[0].id; }
    return null;
  }

  async function save(jsonStr) {
    await ensureToken(true);
    var fid = await findFile();
    if (fid) {
      var r = await api("https://www.googleapis.com/upload/drive/v3/files/" + fid + "?uploadType=media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: jsonStr });
      if (!r.ok) throw new Error("Lưu lên Drive lỗi (" + r.status + ")");
      return fid;
    }
    var boundary = "vpvie" + Date.now();
    var meta = JSON.stringify({ name: FNAME, mimeType: "application/json" });
    var body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta + "\r\n--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + jsonStr + "\r\n--" + boundary + "--";
    var r2 = await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body: body });
    if (!r2.ok) throw new Error("Tạo tệp trên Drive lỗi (" + r2.status + ")");
    var d2 = await r2.json(); ls(false, FID_KEY, d2.id); return d2.id;
  }

  async function load() {
    await ensureToken(true);
    var fid = await findFile();
    if (!fid) { var e = new Error("NO_FILE"); e.code = "NO_FILE"; throw e; }
    var r = await api("https://www.googleapis.com/drive/v3/files/" + fid + "?alt=media");
    if (!r.ok) throw new Error("Tải từ Drive lỗi (" + r.status + ")");
    return await r.text();
  }

  function signOut() { if (token && global.google && global.google.accounts) { try { global.google.accounts.oauth2.revoke(token, function () { }); } catch (e) { } } token = null; }

  global.VPDrive = {
    getClientId: getClientId, setClientId: setClientId,
    signIn: function () { return ensureToken(true); },
    signOut: signOut, save: save, load: load,
    isConfigured: function () { return !!getClientId(); },
    isSignedIn: function () { return !!token; }
  };
})(window);
