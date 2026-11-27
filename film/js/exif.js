// 只讀 JPEG 裡的拍攝日期（DateTimeOriginal），用來預設日期戳記。
// 只在本機解析，不會送出任何資料；匯出的照片也不會帶 EXIF（包含 GPS）。

export async function readPhotoDate(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      const size = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
      if ((marker & 0xff00) !== 0xff00) break;
      off += 2 + size;
    }
  } catch (e) { /* 讀不到就算了 */ }
  return null;
}

function parseTiff(v, start) {
  const le = v.getUint16(start) === 0x4949;
  const u16 = (o) => v.getUint16(start + o, le);
  const u32 = (o) => v.getUint32(start + o, le);
  const readAscii = (o, n) => {
    let s = '';
    for (let i = 0; i < n && start + o + i < v.byteLength; i++) {
      const c = v.getUint8(start + o + i);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const scan = (ifd, want) => {
    if (start + ifd + 2 > v.byteLength) return null;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (start + e + 12 > v.byteLength) return null;
      const tag = u16(e);
      if (tag === want) return { type: u16(e + 2), count: u32(e + 4), value: u32(e + 8) };
    }
    return null;
  };
  let date = null;
  const exifPtr = scan(u32(4), 0x8769);
  if (exifPtr) {
    const dt = scan(exifPtr.value, 0x9003);
    if (dt) date = readAscii(dt.value, dt.count);
  }
  if (!date) {
    const dt = scan(u32(4), 0x0132);
    if (dt) date = readAscii(dt.value, dt.count);
  }
  const m = date && date.match(/^(\d{4}):(\d{2}):(\d{2})/);
  return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
