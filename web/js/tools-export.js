// Xuất bảng ra PNG / PDF bằng html2canvas + jsPDF (nguồn mở).
(function (global) {
  "use strict";
  function dl(url, name) { var a = document.createElement("a"); a.href = url; a.download = name; a.click(); }
  async function snap(el) { return await global.html2canvas(el, { backgroundColor: "#ffffff", scale: 2, logging: false }); }
  async function png(el) { var c = await snap(el); dl(c.toDataURL("image/png"), "bang-day-hoc.png"); }
  async function pdf(el) {
    var c = await snap(el);
    var jsPDF = (global.jspdf || {}).jsPDF;
    var d = new jsPDF({ orientation: c.width >= c.height ? "landscape" : "portrait", unit: "px", format: [c.width, c.height] });
    d.addImage(c.toDataURL("image/png"), "PNG", 0, 0, c.width, c.height);
    d.save("bang-day-hoc.pdf");
  }
  async function print(el) {
    var c = await snap(el);
    var img = c.toDataURL("image/png");
    var w = window.open("", "_blank");
    if (!w) { return false; }
    w.document.open();
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>In trang — VPVie</title>' +
      '<style>@page{margin:10mm}html,body{margin:0;padding:0}img{width:100%;height:auto;display:block}</style></head>' +
      '<body><img src="' + img + '" onload="setTimeout(function(){window.focus();window.print();},150)"></body></html>');
    w.document.close();
    return true;
  }
  global.VPExport = { png: png, pdf: pdf, print: print };
})(window);
