-- 群眾（受眾群組）：把多個標籤組合成一個可重複使用的群發目標
CREATE TABLE audiences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag_ids TEXT NOT NULL, -- JSON array of tag id
  match_type TEXT NOT NULL DEFAULT 'any', -- any: 符合任一標籤即算 / all: 需同時符合所有標籤
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE broadcasts ADD COLUMN target_audience_id TEXT REFERENCES audiences(id) ON DELETE SET NULL;
