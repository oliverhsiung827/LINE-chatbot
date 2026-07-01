-- 圖文選單是否在使用者開啟聊天室時預設展開（LINE createRichMenu 的 selected 欄位）
ALTER TABLE rich_menus ADD COLUMN is_selected INTEGER NOT NULL DEFAULT 0;
