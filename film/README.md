# FilmDoodle · 底片塗鴉機

👉 **線上使用：https://chairchennn.github.io/film/**

把手機或相機照片變成底片感的小工具，手機和電腦都能用，也可以「加到主畫面」當 App 用。

- **一鍵塗鴉邊框**：選一種樣式，照片四周自動長滿手繪塗鴉、中間留給主角（10 種組合：上下／四周／天空／四角／散落 × 繽紛／粉嫩／白線／暖色／冷色），可調數量、大小、加地名文字，按「換一組」重新排列，也能「轉成貼圖」後個別移動或刪除
- **15 種底片色調**：理光 正片 / 負片 / 漂白、富士 Classic Chrome / Classic Neg. / Velvia / Pro 400H / Superia、柯達 Portra / Gold、電影 800T、拋棄式相機、黑白 ACROS / Tri-X
- **底片質感**：顆粒、暗角、光暈（halation）、漏光（5 種樣式）、灰塵刮痕、褪色
- **11 種邊框**：35mm 齒孔底片（黑邊／橘色負片）、粗糙黑邊、120 中片幅、幻燈片框、拍立得、instax mini / square / wide、白邊相紙；可加手寫文字
- **54 個原創手繪塗鴉貼圖**＋文字貼圖（泡泡／霓虹／描邊／手寫）＋上傳自己的 PNG
- **日期戳記**：七段顯示器樣式的橘色日期，預設讀取照片的拍攝日期

## 隱私與安全設計

這個專案刻意做成「照片永遠不離開裝置」：

| 設計 | 做法 |
| --- | --- |
| 不上傳 | 沒有後端；所有運算都在瀏覽器的 `<canvas>` 裡完成 |
| 移除 EXIF / GPS | 匯出時重新繪製成新的 JPG，不會帶出原始照片的位置、相機型號等中繼資料 |
| 嚴格 CSP | `script-src 'self'`、不用 inline script / style、不載入任何第三方 JavaScript；只允許 Google Fonts 字型 |
| 最小儲存 | `localStorage` 只記住上次用的底片／邊框設定，不存照片 |
| 安全解析 | 讀拍攝日期的 EXIF 解析器只讀前 256KB、每個位移都有邊界檢查 |
| 離線 | Service worker 只快取程式本身，照片不經過它 |

## 技術

- 純 HTML / CSS / JavaScript（ES modules），沒有框架、沒有建置步驟
- 底片色調：每個預設是一組參數（白平衡、各色相偏移、曲線、分離色調…），烘焙成 33³ 的 3D LUT，再用四面體內插套到每個像素；拖曳滑桿時用 17³ 的 LUT 保持流暢
- 邊框尺寸照實體規格：35mm 齒孔 2.8×1.98mm、間距 4.75mm；instax mini 54×86mm、畫面 46×62mm 等
- 貼圖是 SVG path，用 `Path2D` 直接畫在 canvas 上，放多大都清楚
- 塗鴉邊框用「最佳候選」取樣（Mitchell's best-candidate）在邊緣權重區域平均撒點，同一組亂數種子在預覽和匯出時位置完全一樣；塗鴉畫在顆粒之前，看起來像印在底片上
- 匯出上限約 1500 萬像素，避免 iPhone Safari 的 canvas 記憶體限制

## 檔案

```
film/
├── index.html            介面
├── style.css             樣式（手機優先，寬螢幕變側欄）
├── js/app.js             介面、手勢（拖曳、雙指縮放旋轉）、匯出
├── js/film.js            底片色調引擎、顆粒／漏光／光暈、日期戳記
├── js/frames.js          邊框
├── js/stickers.js        原創貼圖
├── js/doodles.js         塗鴉邊框產生器
├── js/exif.js            讀取拍攝日期
├── sw.js                 離線快取
└── manifest.webmanifest  PWA 設定
```

本機測試：在 repo 根目錄執行 `python3 -m http.server`，打開 http://localhost:8000/film/ 。

> 底片色調為參考各品牌底片與相機風格的模擬，非官方數值，與理光、富士、柯達等公司無關。
