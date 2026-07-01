# LINE Chatbot 後台管理系統

一個可自架的 LINE 官方帳號後台管理平台，目標涵蓋漸強實驗室、BotBonnie 等廠商的核心功能：

- 會員名單與標籤（分眾）管理
- 關鍵字自動回覆
- 圖文選單（Rich Menu）建立與發佈
- 群發訊息（全體 / 依標籤分眾）
- 儀表板數據總覽

技術棧：React + Vite（前端後台）、Hono（Cloudflare Pages Functions API）、Cloudflare D1（資料庫）、Cloudflare R2（圖片儲存），可透過 GitHub 串接 Cloudflare Pages 自動部署，無需自行維運伺服器。

## 專案結構

```
src/            前端後台 (React + Vite + Tailwind)
functions/      Cloudflare Pages Functions（後端 API 與 LINE webhook）
  api/          管理後台 API（/api/*，需登入）
  webhook/      LINE webhook 接收端點（/webhook/line）
  lib/          共用邏輯：JWT/密碼雜湊、LINE Messaging API client
migrations/     D1 資料庫 schema migrations
shared/         前後端共用的 TypeScript 型別
```

## 本地開發

### 1. 安裝套件

```bash
npm install
```

### 2. 建立本地環境變數

複製 `.dev.vars.example` 為 `.dev.vars`（此檔案已加入 .gitignore，不會被提交）：

```bash
cp .dev.vars.example .dev.vars
```

並填入：
- `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET`：從 LINE Developers Console 取得（本地開發若還沒申請，可先填假值，僅影響實際呼叫 LINE API 的功能）
- `JWT_SECRET`：任意長隨機字串
- `ADMIN_INIT_EMAIL` / `ADMIN_INIT_PASSWORD`：後台第一個管理員帳號，**第一次用此帳密登入時系統會自動建立管理員帳號**（之後可以再新增其他管理員）

### 3. 建立本地 D1 資料庫並套用 schema

```bash
npm run db:migrate:local
```

### 4. 啟動開發伺服器

前端與後端 API 需要分別啟動（Vite 負責前端熱重載，Wrangler 負責模擬 Cloudflare Functions）：

```bash
# 終端機視窗 1：建置前端到 dist（watch 模式可用 vite build --watch，或直接用下方指令跑一次）
npm run build

# 終端機視窗 2：啟動 Pages Functions + 靜態站台（含 D1 / R2 binding）
npx wrangler pages dev dist --local --port=8788
```

之後以瀏覽器開啟 `http://127.0.0.1:8788` 即可使用後台（用 `ADMIN_INIT_EMAIL` / `ADMIN_INIT_PASSWORD` 登入）。

> 若要一邊改前端一邊即時預覽，可另外執行 `npm run dev` 啟動 Vite dev server（`http://localhost:5173`），它已設定將 `/api` 與 `/webhook` 代理到 `http://127.0.0.1:8788`，因此仍需保持 Wrangler 那個終端機視窗運行。

## LINE 官方帳號設定

1. 於 [LINE Developers Console](https://developers.line.biz/) 建立 Provider 與 Messaging API Channel
2. 取得 Channel Access Token（長效）與 Channel Secret，設定到 `.dev.vars`（本地）或 Cloudflare Pages 的 Secrets（正式環境，見下方部署說明）
3. 將 Webhook URL 設定為：`https://<你的網域>/webhook/line`，並開啟「Use webhook」
4. 關閉 LINE 官方帳號的「自動回應訊息」與「加入好友的歡迎訊息」等預設功能（在 LINE Official Account Manager 設定），避免與本系統的關鍵字自動回覆衝突

## 部署到 Cloudflare Pages（透過 GitHub）

### 1. 建立 Cloudflare 資源

```bash
npx wrangler login
npx wrangler d1 create line-chatbot-db
npx wrangler r2 bucket create line-chatbot-assets
```

將 `wrangler d1 create` 回傳的 `database_id` 貼到 `wrangler.toml` 的 `database_id` 欄位，取代 `REPLACE_WITH_D1_DATABASE_ID`，並提交（commit）此變更。

### 2. 套用資料庫 schema 到正式環境

```bash
npm run db:migrate:remote
```

### 3. 推送到 GitHub，並在 Cloudflare Pages 建立專案

1. 將此專案 push 到 GitHub repository
2. 到 Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，選擇這個 repository
3. Build 設定：
   - Build command：`npm run build`
   - Build output directory：`dist`
4. 在 Pages 專案的 Settings → Functions → Bindings 中設定：
   - D1 database binding：`DB` → `line-chatbot-db`
   - R2 bucket binding：`MEDIA` → `line-chatbot-assets`
5. 在 Settings → Environment variables（Production 與 Preview 都要設定）新增以下 Secrets：
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `JWT_SECRET`
   - `ADMIN_INIT_EMAIL`
   - `ADMIN_INIT_PASSWORD`
6. 儲存後觸發部署（或直接 push 一個 commit 到 GitHub 上設定的分支）。之後每次 push 到該分支都會自動重新部署。

### 4. 設定 LINE Webhook

部署完成後，Cloudflare Pages 會提供一個網域（如 `https://your-project.pages.dev`，或你綁定的自訂網域）。回到 LINE Developers Console，將 Webhook URL 設為：

```
https://your-project.pages.dev/webhook/line
```

## 已知限制 / 後續可擴充方向

- 群發訊息目前為「立即發送」，`scheduled_at` 欄位已保留供未來串接 Cloudflare Cron Trigger 實作排程發送
- 圖文選單目前支援手動輸入座標設定點擊區塊，未來可加上視覺化拖拉編輯器
- 尚未實作對話流程建置器（drip campaign / 多步驟情境對話），可作為 Phase 2 功能
- 尚未實作多管理員權限細分（目前僅有單一 role 欄位，未做細部權限控管）
