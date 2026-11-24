# chairchennn.github.io

我的資安 / 滲透測試學習歷程與作品集。這個 repo 同時是:

- 一個**公開的作品集網站**(GitHub Pages)→ `index.html`
- 一個**作品倉庫**:writeups、工具、報告都放在這裡

> ⚠️ 所有練習都在授權靶場(TryHackMe、PortSwigger、自架 DVWA / Juice Shop…)進行。未經授權攻擊他人系統是違法的。

## 🌐 開啟網站(GitHub Pages)

1. 到這個 repo 的 **Settings → Pages**
2. 「Source」選 **Deploy from a branch**
3. Branch 選 **main**、資料夾選 **/(root)**,按 Save
4. 等 1–2 分鐘,你的網站就會在 **https://chairchennn.github.io/** 上線

之後每次 push 到 `main`,網站會自動更新。

## 📁 資料夾結構

| 項目 | 放什麼 |
|---|---|
| `index.html` | 作品集首頁(改這個就能改網站內容,`✏️` 標記處是要你填的) |
| `writeups/` | 靶機 / CTF 解題紀錄 |
| `tools/` | 自己寫的安全工具(每個工具一個子資料夾) |
| `reports/` | 滲透測試報告 |

每個資料夾裡都有 `_TEMPLATE` 或 `README` 可以照著套用。

## ✏️ 怎麼更新

- **改網站文字**:編輯 `index.html`,找 `✏️` 註解的地方換成你的內容。
- **加一篇 writeup**:複製 `writeups/_TEMPLATE.md`,改名成題目名稱,填內容。
- **加一個工具**:在 `tools/` 下開一個子資料夾,放程式 + 該工具的 `README.md`。
- **加一份報告**:複製 `reports/_TEMPLATE.md`,填內容。

改完 commit、push 到 `main` 即可(網站會自動更新)。
