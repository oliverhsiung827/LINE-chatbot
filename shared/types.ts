// 前後端共用的型別定義

export type AdminRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface Admin {
  id: string
  email: string
  name: string
  role: AdminRole
  created_at: string
}

export interface LineUser {
  id: string
  display_name: string | null
  picture_url: string | null
  status_message: string | null
  followed_at: string | null
  unfollowed_at: string | null
  is_blocked: number
  last_interaction_at: string | null
  created_at: string
  tags?: Tag[]
}

export interface Tag {
  id: number
  name: string
  color: string
  created_at: string
  member_count?: number
}

export type MatchType = 'exact' | 'contains' | 'regex'
export type ReplyType = 'text' | 'image' | 'flex' | 'sticker' | 'imagemap'

export interface KeywordRule {
  id: number
  name: string
  match_type: MatchType
  keywords: string[]
  reply_type: ReplyType
  reply_content: TextReplyContent | ImageReplyContent | RichMessageRefContent | StickerReplyContent
  is_active: number
  priority: number
  created_at: string
  updated_at: string
}

export interface TextReplyContent {
  text: string
}
export interface ImageReplyContent {
  originalContentUrl: string
  previewImageUrl: string
}
export interface StickerReplyContent {
  packageId: string
  stickerId: string
}
// reply_type 'flex'（多頁訊息 / Flex Carousel）與 'imagemap'（圖文訊息／進階影片訊息）
// 皆改為參照「進階訊息素材庫」(rich_messages) 裡建好的內容，而非直接內嵌完整 JSON
export interface RichMessageRefContent {
  rich_message_id: string
}

// ---- 進階訊息素材庫 (Rich Message Library) ----

export type RichMessageType = 'imagemap' | 'flex_carousel'

export interface ImagemapAction {
  type: 'uri' | 'message'
  area: { x: number; y: number; width: number; height: number }
  uri?: string
  text?: string
  label?: string
}

export interface ImagemapVideo {
  area: { x: number; y: number; width: number; height: number }
  video_key: string | null
  preview_key: string | null
  external_link?: { linkUri: string; label: string }
}

export interface ImagemapContent {
  altText: string
  baseSize: { width: number; height: number }
  image_key: string | null
  actions: ImagemapAction[]
  video: ImagemapVideo | null
}

export interface FlexCarouselButton {
  label: string
  action: { type: 'uri'; uri: string } | { type: 'message'; text: string } | { type: 'postback'; data: string }
}

export interface FlexCarouselCard {
  image_key: string | null
  title: string
  text: string
  buttons: FlexCarouselButton[]
}

export interface FlexCarouselContent {
  altText: string
  cards: FlexCarouselCard[]
}

export interface RichMessage {
  id: string
  type: RichMessageType
  name: string
  content: ImagemapContent | FlexCarouselContent
  created_at: string
  updated_at: string
}

export interface RichMenuArea {
  bounds: { x: number; y: number; width: number; height: number }
  action:
    | { type: 'uri'; uri: string; label?: string }
    | { type: 'message'; text: string; label?: string }
    | { type: 'postback'; data: string; label?: string; displayText?: string }
    | { type: 'richmenuswitch'; richMenuAliasId: string; data: string; label?: string }
}

export type RichMenuStatus = 'draft' | 'published'

export interface RichMenu {
  id: string
  name: string
  chat_bar_text: string
  image_url: string | null
  size_width: number
  size_height: number
  areas: RichMenuArea[]
  is_default: number
  is_selected: number
  status: RichMenuStatus
  created_at: string
}

export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
export type BroadcastTargetType = 'all' | 'tag'

export interface Broadcast {
  id: number
  title: string
  message_type: ReplyType
  message_content: TextReplyContent | ImageReplyContent | RichMessageRefContent | StickerReplyContent
  target_type: BroadcastTargetType
  target_tag_ids: number[] | null
  status: BroadcastStatus
  scheduled_at: string | null
  sent_at: string | null
  recipient_count: number
  created_by: string | null
  created_at: string
}

export interface DashboardStats {
  total_members: number
  new_members_7d: number
  blocked_members: number
  messages_7d: number
  active_keyword_rules: number
  recent_broadcasts: Broadcast[]
}

export interface ApiError {
  error: string
}
