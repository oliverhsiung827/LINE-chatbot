-- 進階訊息素材庫：圖文訊息(Imagemap)、進階影片訊息(Imagemap+Video)、多頁訊息(Flex Carousel)
CREATE TABLE rich_messages (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- imagemap | flex_carousel
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
