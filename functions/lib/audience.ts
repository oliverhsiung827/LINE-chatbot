import type { Env } from './env'

// tag_groups: 群組之間為 OR，群組內的標籤為 AND。例如 [[A,B],[C]] 代表「(A 且 B) 或 C」的人。
// 用一個群組跑一次查詢再用 Set 聯集，避免手動組裝複雜的動態 SQL。
export async function resolveAudienceUserIds(env: Env, tagGroups: number[][]): Promise<string[]> {
  const userIds = new Set<string>()
  for (const group of tagGroups) {
    if (!group.length) continue
    const placeholders = group.map(() => '?').join(',')
    const rows = await env.DB.prepare(
      `SELECT u.id FROM line_users u
       JOIN member_tags mt ON mt.user_id = u.id
       WHERE mt.tag_id IN (${placeholders}) AND u.is_blocked = 0
       GROUP BY u.id
       HAVING COUNT(DISTINCT mt.tag_id) = ?`
    )
      .bind(...group, group.length)
      .all()
    for (const row of rows.results) userIds.add((row as { id: string }).id)
  }
  return Array.from(userIds)
}
