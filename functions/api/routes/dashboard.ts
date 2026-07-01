import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
dashboardRoutes.use('*', requireAuth)

dashboardRoutes.get('/stats', async (c) => {
  const [totalMembers, newMembers7d, blockedMembers, messages7d, activeKeywordRules, recentBroadcasts] =
    await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM line_users').first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM line_users WHERE created_at >= datetime('now', '-7 days')").first<{
        count: number
      }>(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM line_users WHERE is_blocked = 1').first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM message_logs WHERE created_at >= datetime('now', '-7 days')"
      ).first<{ count: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM keyword_rules WHERE is_active = 1').first<{ count: number }>(),
      c.env.DB.prepare('SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 5').all(),
    ])

  return c.json({
    total_members: totalMembers?.count ?? 0,
    new_members_7d: newMembers7d?.count ?? 0,
    blocked_members: blockedMembers?.count ?? 0,
    messages_7d: messages7d?.count ?? 0,
    active_keyword_rules: activeKeywordRules?.count ?? 0,
    recent_broadcasts: recentBroadcasts.results.map((r) => {
      const row = r as Record<string, unknown>
      return {
        ...row,
        message_content: JSON.parse(row.message_content as string),
        target_tag_ids: row.target_tag_ids ? JSON.parse(row.target_tag_ids as string) : null,
      }
    }),
  })
})
