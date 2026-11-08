#!/usr/bin/env node
// VPVie – Công cụ phát hành key theo máy (dùng cho NGƯỜI PHÁT HÀNH).
// Giữ BÍ MẬT tệp private-key.b64. Khoá công khai đã nhúng sẵn trong web/js/license.js.
//
// Tạo cặp khoá mới (chạy MỘT lần, rồi dán khoá công khai in ra vào license.js):
//   node keygen.js genkeys
//
// Cấp 1 key cho một máy:
//   node keygen.js issue <MÃ_MÁY> [--plan pro] [--days 365] [--note "Cô Lan"]
//   (--days 0 hoặc bỏ qua = vĩnh viễn)
//
// Cấp hàng loạt từ tệp (mỗi dòng: MÃ_MÁY[,ghi chú]):
//   node keygen.js batch may.txt --plan pro --days 365 > keys.csv
//
// Cấp key DÙNG NHIỀU MÁY (kích hoạt qua máy chủ, giới hạn số máy):
//   node keygen.js license --max 5 [--plan pro] [--days 365] [--note "Trường A"]
//   (Key không gắn 1 máy; máy chủ đếm số máy đã kích hoạt, tối đa --max.)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const KEYFILE = path.join(__dirname, 'private-key.b64');

const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function genkeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  fs.writeFileSync(KEYFILE, privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'));
  const pub = b64u(publicKey.export({ type: 'spki', format: 'der' }));
  console.log('Đã ghi khoá riêng vào: ' + KEYFILE + '  (GIỮ BÍ MẬT, đừng commit!)');
  console.log('\nDán dòng sau vào web/js/license.js (biến PUBKEY_SPKI_B64URL):\n');
  console.log('  PUBKEY_SPKI_B64URL = "' + pub + '";');
}

function loadPriv() {
  if (!fs.existsSync(KEYFILE)) { console.error('Chưa có khoá riêng. Chạy: node keygen.js genkeys'); process.exit(1); }
  return crypto.createPrivateKey({ key: fs.readFileSync(KEYFILE, 'utf8'), format: 'der', type: 'pkcs8', encoding: 'base64' });
}

function issueKey(priv, mid, plan, days, note) {
  mid = String(mid || '').trim().toUpperCase();
  if (!/^VPV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(mid)) throw new Error('Mã máy sai định dạng: ' + mid);
  const payload = { m: mid, p: plan || 'pro', e: days > 0 ? Math.floor(Date.now() / 1000) + days * 86400 : 0 };
  if (note) payload.n = note;
  const pbytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.sign('sha256', pbytes, { key: priv, dsaEncoding: 'ieee-p1363' });
  return 'VPL1.' + b64u(pbytes) + '.' + b64u(sig);
}

// Key dùng nhiều máy: không gắn mã máy, có license id + giới hạn số máy (maxm).
function issueLicense(priv, plan, days, note, maxm) {
  const payload = { id: crypto.randomUUID().replace(/-/g, '').slice(0, 16), p: plan || 'pro', e: days > 0 ? Math.floor(Date.now() / 1000) + days * 86400 : 0, maxm: maxm > 0 ? maxm : 1 };
  if (note) payload.n = note;
  const pbytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.sign('sha256', pbytes, { key: priv, dsaEncoding: 'ieee-p1363' });
  return { key: 'VPL1.' + b64u(pbytes) + '.' + b64u(sig), id: payload.id };
}

function opt(args, name, def) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; }

function main() {
  const args = process.argv.slice(2), cmd = args[0];
  if (cmd === 'genkeys') return genkeys();
  const plan = opt(args, 'plan', 'pro'), days = parseInt(opt(args, 'days', '0'), 10) || 0, note = opt(args, 'note', '');
  if (cmd === 'issue') {
    const key = issueKey(loadPriv(), args[1], plan, days, note);
    console.log(key);
  } else if (cmd === 'license') {
    const maxm = parseInt(opt(args, 'max', '1'), 10) || 1;
    const r = issueLicense(loadPriv(), plan, days, note, maxm);
    console.error('License ID: ' + r.id + '  (tối đa ' + maxm + ' máy)');
    console.log(r.key);
  } else if (cmd === 'batch') {
    const priv = loadPriv();
    const lines = fs.readFileSync(args[1], 'utf8').split(/\r?\n/).filter(Boolean);
    console.log('ma_may,ghi_chu,key');
    for (const ln of lines) {
      const [mid, n] = ln.split(',');
      try { console.log([mid.trim(), (n || note || '').trim(), issueKey(priv, mid, plan, days, (n || note || '').trim())].join(',')); }
      catch (e) { console.error('Bỏ qua: ' + e.message); }
    }
  } else {
    console.log('Dùng: node keygen.js genkeys | issue <MÃ_MÁY> [...] | license --max 5 [...] | batch <tệp.txt>');
  }
}
main();
