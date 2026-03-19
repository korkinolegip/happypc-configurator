import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import BuildPage from './pages/BuildPage'
import CreateBuildPage from './pages/CreateBuildPage'
import EditBuildPage from './pages/EditBuildPage'
import ProfilePage from './pages/ProfilePage'
import AdminLayout from './pages/admin/AdminLayout'
import DashboardPage from './pages/admin/DashboardPage'
import UsersPage from './pages/admin/UsersPage'
import WorkshopsPage from './pages/admin/WorkshopsPage'
import SettingsPage from './pages/admin/SettingsPage'
import BuildsPage from './pages/admin/BuildsPage'

function App() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-th-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
          <span className="text-th-text-2 text-sm">Загрузка...</span>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/b/:short_code" element={<Layout><BuildPage /></Layout>} />
        <Route
          path="/"
          element={
            <Layout>
              <HomePage />
            </Layout>
          }
        />
        <Route
          path="/builds/create"
          element={
            <ProtectedRoute>
              <Layout>
                <CreateBuildPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/builds/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <EditBuildPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="builds" element={<BuildsPage />} />
          <Route path="workshops" element={<WorkshopsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
