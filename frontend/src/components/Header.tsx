import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, User, LogOut, Shield, Sun, Moon, Home } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../context/ThemeContext'
import toast from 'react-hot-toast'

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await logout()
    setDropdownOpen(false)
    navigate('/login')
    toast.success('Вы вышли из системы')
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  return (
    <header className="sticky top-0 z-40" style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0 relative z-10 touch-manipulation">
            <img
              src="/logo-icon.png"
              alt=""
              className="h-8 w-auto pointer-events-none"
            />
            <img
              src={theme === 'dark' ? '/logo-text-white.png' : '/logo-text-black.png'}
              alt="HappyPC"
              className="h-4 w-auto pointer-events-none"
            />
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-2)' }}
              title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {isAuthenticated && user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text)' }}
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#FF6B00] flex items-center justify-center text-white text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm hidden sm:block max-w-[120px] truncate" style={{ color: 'var(--text)' }}>
                    {user.name}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-2)' }}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg py-1 z-50" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                    <Link
                      to="/"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--text)' }}
                    >
                      <Home size={15} style={{ color: 'var(--text-2)' }} />
                      На главную
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--text)' }}
                    >
                      <User size={15} style={{ color: 'var(--text-2)' }} />
                      Профиль
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                        style={{ color: 'var(--text)' }}
                      >
                        <Shield size={15} className="text-[#FF6B00]" />
                        Администрирование
                      </Link>
                    )}
                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 w-full text-left transition-colors"
                    >
                      <LogOut size={15} />
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-[#FF6B00] hover:bg-[#E05A00] text-white font-medium px-4 py-2 rounded text-sm transition-colors"
              >
                Войти
              </Link>
            )}

          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
