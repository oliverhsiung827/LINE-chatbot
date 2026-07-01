import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '../lib/api'
import type { Admin } from '../../shared/types'
import { useAuth } from '../contexts/AuthContext'
import { formatTaipei } from '../lib/time'

export default function Admins() {
  const { admin: me } = useAuth()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setAdmins(await api.get<Admin[]>('/admins'))
  }

  useEffect(() => {
    load()
  }, [])

  async function createAdmin() {
    setError(null)
    if (!email.trim() || !name.trim() || !password) {
      setError('請填寫帳號、姓名與密碼')
      return
    }
    setSaving(true)
    try {
      await api.post('/admins', { email: email.trim(), name: name.trim(), password })
      setEmail('')
      setName('')
      setPassword('')
      load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : '新增失敗')
    } finally {
      setSaving(false)
    }
  }

  async function removeAdmin(id: string) {
    if (!confirm('確定要刪除此管理者帳號嗎？')) return
    try {
      await api.delete(`/admins/${id}`)
      load()
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : '刪除失敗')
    }
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-slate-800">管理者</h2>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">新增管理者</h3>
          {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="space-y-2 text-sm">
            <label className="block">
              <span className="mb-1 block text-slate-600">帳號（Email）</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">姓名</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">密碼（至少 8 碼）</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
            </label>
            <button
              onClick={createAdmin}
              disabled={saving}
              className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? '新增中...' : '新增管理者'}
            </button>
            <p className="text-xs text-slate-400">目前所有管理者帳號權限相同，沒有角色區分。請自行把帳密告知新的管理者。</p>
          </div>
        </div>

        <ChangePassword />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">姓名</th>
              <th className="px-4 py-2">帳號</th>
              <th className="px-4 py-2">建立時間</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {a.name} {a.id === me?.id && <span className="text-xs text-slate-400">（我）</span>}
                </td>
                <td className="px-4 py-2 text-slate-500">{a.email}</td>
                <td className="px-4 py-2 text-slate-500">{formatTaipei(a.created_at)}</td>
                <td className="px-4 py-2">
                  {a.id !== me?.id && (
                    <button onClick={() => removeAdmin(a.id)} className="text-xs text-red-500 hover:underline">
                      刪除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setError(null)
    setSuccess(false)
    if (!current || !next) {
      setError('請輸入目前密碼與新密碼')
      return
    }
    setSaving(true)
    try {
      await api.patch('/admins/me/password', { current_password: current, new_password: next })
      setCurrent('')
      setNext('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : '修改失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">修改我的密碼</h3>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {success && <p className="mb-3 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">密碼已更新</p>}
      <div className="space-y-2 text-sm">
        <label className="block">
          <span className="mb-1 block text-slate-600">目前密碼</span>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">新密碼（至少 8 碼）</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <button onClick={save} disabled={saving} className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? '更新中...' : '更新密碼'}
        </button>
      </div>
    </div>
  )
}
