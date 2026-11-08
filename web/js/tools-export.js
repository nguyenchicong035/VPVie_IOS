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
  global.VPExport = { png: png, pdf: pdf };
})(window);
