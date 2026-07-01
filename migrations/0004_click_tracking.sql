-- 點擊追蹤與分眾標籤：紀錄「開啟連結」類型按鈕實際指向的網址，
-- 透過 LIFF 轉址頁在點擊當下辨識使用者並自動貼標籤
CREATE TABLE click_targets (
  id TEXT PRIMARY KEY,
  target_url TEXT NOT NULL,
  tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE click_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  click_target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_click_events_target ON click_events(click_target_id);

-- 關鍵字自動回覆命中時，可直接為使用者貼上標籤
ALTER TABLE keyword_rules ADD COLUMN tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL;
