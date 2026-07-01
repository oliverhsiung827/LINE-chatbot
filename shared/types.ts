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
export type ReplyType = 'text' | 'image' | 'flex' | 'sticker'

export interface KeywordRule {
  id: number
  name: string
  match_type: MatchType
  keywords: string[]
  reply_type: ReplyType
  reply_content: TextReplyContent | ImageReplyContent | FlexReplyContent | StickerReplyContent
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
export interface FlexReplyContent {
  altText: string
  contents: unknown
}
export interface StickerReplyContent {
  packageId: string
  stickerId: string
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
  status: RichMenuStatus
  created_at: string
}

export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
export type BroadcastTargetType = 'all' | 'tag'

export interface Broadcast {
  id: number
  title: string
  message_type: ReplyType
  message_content: TextReplyContent | ImageReplyContent | FlexReplyContent | StickerReplyContent
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
