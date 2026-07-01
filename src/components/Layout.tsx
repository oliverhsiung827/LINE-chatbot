import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: '儀表板', end: true },
  { to: '/members', label: '會員管理' },
  { to: '/tags', label: '標籤管理' },
  { to: '/audiences', label: '群眾管理' },
  { to: '/join-links', label: '會員來源追蹤' },
  { to: '/keywords', label: '關鍵字自動回覆' },
  { to: '/rich-menus', label: '圖文選單' },
  { to: '/rich-messages', label: '進階訊息素材庫' },
  { to: '/broadcasts', label: '群發訊息' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth()

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <h1 className="text-sm font-bold text-slate-800">LINE Chatbot 後台</h1>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
          <p className="mb-2 truncate">{admin?.name}（{admin?.email}）</p>
          <button onClick={() => logout()} className="text-slate-500 underline hover:text-slate-700">
            登出
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
    </div>
  )
}
