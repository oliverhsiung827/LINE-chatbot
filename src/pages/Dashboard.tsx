import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { DashboardStats } from '../../shared/types'
import { formatTaipei } from '../lib/time'

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  scheduled: '排程中',
  sending: '發送中',
  sent: '已發送',
  failed: '失敗',
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    api.get<DashboardStats>('/dashboard/stats').then(setStats)
  }, [])

  if (!stats) return <p className="text-slate-400">載入中...</p>

  const cards = [
    { label: '總會員數', value: stats.total_members },
    { label: '近 7 天新增會員', value: stats.new_members_7d },
    { label: '封鎖/退追蹤人數', value: stats.blocked_members },
    { label: '近 7 天訊息數', value: stats.messages_7d },
    { label: '啟用中關鍵字規則', value: stats.active_keyword_rules },
  ]

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-slate-800">儀表板</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <h3 className="mb-3 text-sm font-semibold text-slate-700">最近的群發訊息</h3>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">標題</th>
              <th className="px-4 py-2">狀態</th>
              <th className="px-4 py-2">收件人數</th>
              <th className="px-4 py-2">建立時間</th>
            </tr>
          </thead>
          <tbody>
            {stats.recent_broadcasts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  尚無群發訊息
                </td>
              </tr>
            )}
            {stats.recent_broadcasts.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{b.title}</td>
                <td className="px-4 py-2">{STATUS_LABEL[b.status] ?? b.status}</td>
                <td className="px-4 py-2">{b.recipient_count}</td>
                <td className="px-4 py-2 text-slate-500">{formatTaipei(b.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
