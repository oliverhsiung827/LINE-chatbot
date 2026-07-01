-- 後台管理者帳號
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- LINE 好友 / 會員
CREATE TABLE line_users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  picture_url TEXT,
  status_message TEXT,
  followed_at TEXT,
  unfollowed_at TEXT,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  last_interaction_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_line_users_blocked ON line_users(is_blocked);
CREATE INDEX idx_line_users_created ON line_users(created_at);

-- 會員標籤
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE member_tags (
  user_id TEXT NOT NULL REFERENCES line_users(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tagged_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX idx_member_tags_tag ON member_tags(tag_id);

-- 關鍵字自動回覆規則
CREATE TABLE keyword_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'exact',
  keywords TEXT NOT NULL,
  reply_type TEXT NOT NULL DEFAULT 'text',
  reply_content TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_keyword_rules_active ON keyword_rules(is_active, priority);

-- 圖文選單（id 為本地 UUID，line_rich_menu_id 為發佈到 LINE 後取得的 richMenuId）
CREATE TABLE rich_menus (
  id TEXT PRIMARY KEY,
  line_rich_menu_id TEXT,
  name TEXT NOT NULL,
  chat_bar_text TEXT NOT NULL DEFAULT '選單',
  image_key TEXT,
  size_width INTEGER NOT NULL DEFAULT 2500,
  size_height INTEGER NOT NULL DEFAULT 1686,
  areas TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 群發訊息
CREATE TABLE broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  message_content TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'all',
  target_tag_ids TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  sent_at TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 對話訊息紀錄（聊天記錄 / 分析用）
CREATE TABLE message_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_message_logs_user ON message_logs(user_id, created_at);
CREATE INDEX idx_message_logs_created ON message_logs(created_at);
