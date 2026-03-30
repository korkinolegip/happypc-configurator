import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  ChevronLeft,
  Menu,
  Cpu,
  Monitor,
  Megaphone,
  MessageSquare,
  Database,
  Shield,
  Store,
  Mail,
} from 'lucide-react'

const navItems = [
  { to: '/admin', label: 'Дашборд', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Пользователи', icon: Users, end: false },
  { to: '/admin/builds', label: 'Сборки', icon: Monitor, end: false },
  { to: '/admin/banners', label: 'Баннеры', icon: Megaphone, end: false },
  { to: '/admin/comments', label: 'Комментарии', icon: MessageSquare, end: false },
  { to: '/admin/workshops', label: 'Мастерские', icon: Building2, end: false },
  { to: '/admin/stores', label: 'Магазины', icon: Store, end: false },
  { to: '/admin/permissions', label: 'Разрешения', icon: Shield, end: false },
  { to: '/admin/email', label: 'Почта', icon: Mail, end: false },
  { to: '/admin/backup', label: 'Бэкапы', icon: Database, end: false },
  { to: '/admin/settings', label: 'Настройки', icon: Settings, end: false },
]

const AdminLayout: React.FC = () => {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-th-bg flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-th-surface border-r border-th-border transition-all duration-200 ${
          sidebarOpen ? 'w-56' : 'w-14'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-16 px-3 border-b border-th-border">
          {sidebarOpen && (
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <Cpu size={20} className="text-[#FF6B00] shrink-0" />
              <span className="font-bold text-th-text text-sm">
                <span>Happy</span>
                <span className="text-[#FF6B00]">PC</span>
                <span className="text-th-text-2 font-normal ml-1 text-xs">Admin</span>
              </span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 text-th-text-2 hover:text-th-text hover:bg-th-surface-2 rounded transition-colors ml-auto"
          >
            <ChevronLeft
              size={16}
              className={`transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 space-y-0.5 px-1.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'bg-[#FF6B00]/15 text-[#FF6B00]'
                    : 'text-th-text-2 hover:text-th-text hover:bg-th-surface-2'
                } ${!sidebarOpen ? 'justify-center' : ''}`
              }
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={17} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Back to site */}
        <div className="p-2 border-t border-th-border">
          <button
            onClick={() => navigate('/')}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-th-text-2 hover:text-th-text hover:bg-th-surface-2 transition-colors text-sm w-full ${
              !sidebarOpen ? 'justify-center' : ''
            }`}
            title={!sidebarOpen ? 'На сайт' : undefined}
          >
            <ChevronLeft size={16} className="shrink-0" />
            {sidebarOpen && <span>На сайт</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`md:hidden fixed left-0 top-0 bottom-0 w-56 bg-th-surface border-r border-th-border z-50 transition-transform duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 h-16 px-4 border-b border-th-border">
          <Cpu size={20} className="text-[#FF6B00]" />
          <span className="font-bold text-th-text text-sm">
            Happy<span className="text-[#FF6B00]">PC</span>
            <span className="text-th-text-2 font-normal ml-1 text-xs">Admin</span>
          </span>
        </div>
        <nav className="py-3 space-y-0.5 px-1.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'bg-[#FF6B00]/15 text-[#FF6B00]'
                    : 'text-th-text-2 hover:text-th-text hover:bg-th-surface-2'
                }`
              }
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 h-14 px-4 bg-th-surface border-b border-th-border">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 text-th-text-2 hover:text-th-text transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-th-text text-sm">
            Happy<span className="text-[#FF6B00]">PC</span>
            <span className="text-th-text-2 font-normal ml-1 text-xs">Admin</span>
          </span>
        </div>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
