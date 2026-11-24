# [題目名稱] — [平台,例如 TryHackMe]

- **難度**:Easy / Medium / Hard
- **類別**:Web / Crypto / Forensics / 靶機 …
- **日期**:2026-XX-XX
- **用到的技能**:Nmap、列舉、提權 …

## TL;DR(一句話總結)

> 用一兩句講這台機器/題目的攻擊路徑,例如:透過過期的服務版本取得立足點,再利用 SUID 設定錯誤提權到 root。

## 1. 偵察(Recon)

掃描結果、開放的服務與版本。

```bash
nmap -sV -sC <ip>
```

(貼關鍵輸出 / 截圖)

## 2. 列舉(Enumeration)

你怎麼進一步挖掘,找到可利用的點。

## 3. 取得立足點(Foothold)

怎麼拿到第一個 shell。

## 4. 提權(Privilege Escalation)

怎麼從一般使用者變成 root / admin。

## 5. 旗子 / 成果

拿到什麼(flag 打碼即可)。

## 學到什麼 & 修補建議

- 這題教會我:…
- 如果是防守方,該怎麼擋:…
