-- 關鍵字自動回覆：可設定生效期間（不設定 = 永久有效），時間一律存 UTC
ALTER TABLE keyword_rules ADD COLUMN start_at TEXT;
ALTER TABLE keyword_rules ADD COLUMN end_at TEXT;

-- 群發訊息排程發送：status 會多一個 'scheduled'，由定時 Worker 檢查 scheduled_at 到期後觸發
-- scheduled_at 欄位原本就存在（尚未使用），這裡不需要新增欄位
