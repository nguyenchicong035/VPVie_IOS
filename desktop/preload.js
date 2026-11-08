// Preload tối giản: đánh dấu đang chạy trong ứng dụng máy tính (nếu frontend cần biết).
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('VPDesktop', { isApp: true, platform: process.platform });
