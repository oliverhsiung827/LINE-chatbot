-- 讓群眾可以同時使用 AND 與 OR：改成「群組」結構，群組之間是 OR，群組內的標籤是 AND。
-- 例如 tag_groups = [[A,B],[C]] 代表「（同時有 A 且 B）或（有 C）」的人。
ALTER TABLE audiences ADD COLUMN tag_groups TEXT;

-- 搬移舊資料（用純字串處理，避免依賴 json_each 這類 SQLite 擴充函式的支援度問題）：
-- match_type='all' 時整批標籤變成一個 AND 群組；
-- match_type='any' 時每個標籤各自變成一個群組（彼此 OR），維持原本的比對結果不變
UPDATE audiences
SET tag_groups = CASE
  WHEN match_type = 'all' THEN '[' || tag_ids || ']'
  ELSE '[[' || REPLACE(SUBSTR(tag_ids, 2, LENGTH(tag_ids) - 2), ',', '],[') || ']]'
END
WHERE tag_groups IS NULL;

ALTER TABLE audiences DROP COLUMN tag_ids;
ALTER TABLE audiences DROP COLUMN match_type;
