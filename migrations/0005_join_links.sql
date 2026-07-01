-- 會員來源追蹤連結：每組連結/QR code 對應一個名稱與自動貼上的標籤，
-- 透過此連結加入好友（或已是好友時開啟）的人會自動被貼標，方便追蹤活動成效
CREATE TABLE join_links (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE join_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  join_link_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_join_events_link ON join_events(join_link_id);
