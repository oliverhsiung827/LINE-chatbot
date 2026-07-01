import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import Tags from './pages/Tags'
import JoinLinks from './pages/JoinLinks'
import Keywords from './pages/Keywords'
import RichMenus from './pages/RichMenus'
import RichMessages from './pages/RichMessages'
import Broadcasts from './pages/Broadcasts'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400">載入中...</div>
  if (!admin) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/members" element={<Members />} />
                <Route path="/tags" element={<Tags />} />
                <Route path="/join-links" element={<JoinLinks />} />
                <Route path="/keywords" element={<Keywords />} />
                <Route path="/rich-menus" element={<RichMenus />} />
                <Route path="/rich-messages" element={<RichMessages />} />
                <Route path="/broadcasts" element={<Broadcasts />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
