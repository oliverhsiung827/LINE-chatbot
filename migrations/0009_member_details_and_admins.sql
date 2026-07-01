-- 會員手動記錄欄位（LINE 本身不提供電話/Email/生日等資料，需要後台人員自行記錄）
ALTER TABLE line_users ADD COLUMN phone TEXT;
ALTER TABLE line_users ADD COLUMN email TEXT;
ALTER TABLE line_users ADD COLUMN birthday TEXT;
ALTER TABLE line_users ADD COLUMN notes TEXT;
