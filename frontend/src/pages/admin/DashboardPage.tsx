import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, HardDrive, Building2, ArrowRight, TrendingUp, Store } from 'lucide-react'
import { getDashboard } from '../../api/admin'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(price)

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })

const DashboardPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboard,
  })

  const stats = [
    {
      label: 'Пользователей',
      value: data?.users_count ?? 0,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-900/20 border-blue-800/30',
      link: '/admin/users',
    },
    {
      label: 'Сборок',
      value: data?.builds_count ?? 0,
      icon: HardDrive,
      color: 'text-[#FF6B00]',
      bg: 'bg-orange-900/20 border-orange-800/30',
      link: '/admin/builds',
    },
    {
      label: 'Мастерских',
      value: data?.workshops_count ?? 0,
      icon: Building2,
      color: 'text-green-400',
      bg: 'bg-green-900/20 border-green-800/30',
      link: '/admin/workshops',
    },
    {
      label: 'Магазинов',
      value: data?.stores_count ?? 0,
      icon: Store,
      color: 'text-purple-400',
      bg: 'bg-purple-900/20 border-purple-800/30',
      link: '/admin/stores',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-th-text">Дашборд</h1>
        <p className="text-th-text-2 text-sm mt-1">Обзор системы HappyPC</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, link }) => (
          <Link
            to={link}
            key={label}
            className={`bg-th-surface border rounded-lg p-3 sm:p-5 ${bg} hover:border-[#FF6B00]/50 transition-colors`}
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-th-text-2 text-xs sm:text-sm">{label}</span>
              <div className={`p-1.5 sm:p-2 rounded-lg bg-th-surface-2`}>
                <Icon size={16} className={`${color} sm:w-[18px] sm:h-[18px]`} />
              </div>
            </div>
            {isLoading ? (
              <div className="h-8 bg-th-surface-2 rounded animate-pulse w-16" />
            ) : (
              <span className="text-3xl font-bold text-th-text">{value.toLocaleString('ru-RU')}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent builds */}
        <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
            <h2 className="text-th-text font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-[#FF6B00]" />
              Последние сборки
            </h2>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-th-surface-2 rounded animate-pulse" />
              ))}
            </div>
          ) : data?.recent_builds && data.recent_builds.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header text-left">Сборка</th>
                    <th className="table-header text-left">Автор</th>
                    <th className="table-header text-right">Цена</th>
                    <th className="table-header text-right">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_builds.slice(0, 10).map((build) => (
                    <tr
                      key={build.id}
                      className="hover:bg-th-surface-2 transition-colors border-b border-th-border last:border-0"
                    >
                      <td className="table-cell">
                        <Link
                          to={`/b/${build.short_code}`}
                          className="text-th-text hover:text-[#FF6B00] transition-colors text-sm font-medium line-clamp-1"
                          target="_blank"
                        >
                          {build.title}
                        </Link>
                      </td>
                      <td className="table-cell text-th-text-2 text-sm">{build.author_name}</td>
                      <td className="table-cell text-right text-sm text-th-text">
                        {formatPrice(build.total_price)}
                      </td>
                      <td className="table-cell text-right text-xs text-th-text-2">
                        {formatDate(build.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-th-text-2 text-sm">Нет данных</div>
          )}
        </div>

        {/* Masters activity */}
        <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
            <h2 className="text-th-text font-semibold flex items-center gap-2">
              <Users size={16} className="text-[#FF6B00]" />
              Активность мастеров
            </h2>
            <Link
              to="/admin/users"
              className="text-xs text-th-text-2 hover:text-[#FF6B00] flex items-center gap-1 transition-colors"
            >
              Все <ArrowRight size={12} />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-th-surface-2 rounded animate-pulse" />
              ))}
            </div>
          ) : data?.masters_activity && data.masters_activity.length > 0 ? (
            <div className="divide-y divide-th-border">
              {data.masters_activity.map((master) => (
                <div
                  key={master.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-th-surface-2 transition-colors"
                >
                  {master.avatar_url ? (
                    <img
                      src={master.avatar_url}
                      alt={master.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#FF6B00] flex items-center justify-center text-th-text text-xs font-bold shrink-0">
                      {master.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-th-text text-sm font-medium truncate">{master.name}</p>
                    {master.workshop_name && (
                      <p className="text-th-text-2 text-xs truncate">{master.workshop_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <HardDrive size={13} className="text-th-text-2" />
                    <span className="text-th-text text-sm font-medium">{master.builds_count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-th-text-2 text-sm">Нет данных</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
