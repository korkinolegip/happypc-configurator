import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Building2, Calendar } from 'lucide-react'
import { client } from '../api/client'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['public-user', userId],
    queryFn: async () => {
      const { data } = await client.get(`/api/public/user/${userId}`)
      return data
    },
    enabled: !!userId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.user) {
    return (
      <div className="text-center py-20">
        <p className="text-th-text-2">Пользователь не найден</p>
      </div>
    )
  }

  const user = data.user
  const builds = data.builds || []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile card */}
      <div className="bg-th-surface border border-th-border rounded-lg p-5 sm:p-6">
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-th-border" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-2xl font-bold text-[#FF6B00] border-2 border-[#FF6B00]/30">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-th-text font-bold text-xl">{user.name}</h1>
            {user.workshop_name && (
              <p className="text-[#FF6B00] text-sm font-medium flex items-center gap-1 mt-0.5">
                <Building2 size={13} />
                {user.workshop_name}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-th-text-3">
              {user.city && (
                <span className="flex items-center gap-1"><MapPin size={11} />{user.city}</span>
              )}
              {user.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  На сайте с {new Date(user.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Builds */}
      <div>
        <h2 className="text-th-text font-semibold text-lg mb-3">
          Сборки ({user.builds_count || builds.length})
        </h2>
        {builds.length === 0 ? (
          <div className="bg-th-surface border border-th-border rounded-lg p-8 text-center text-th-text-2">
            Нет публичных сборок
          </div>
        ) : (
          <div className="space-y-3">
            {builds.map((build: any) => (
              <Link key={build.id} to={`/b/${build.short_code}`}
                className="block bg-th-surface border border-th-border rounded-lg p-4 hover:border-[#FF6B00]/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-th-text font-semibold text-sm truncate">{build.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[#FF6B00] font-bold text-sm whitespace-nowrap">{formatPrice(build.total_price)} ₽</span>
                      <span className="text-th-text-3 text-xs">{build.items_count} компонентов</span>
                    </div>
                    <span className="text-th-muted text-xs mt-0.5 block">
                      {new Date(build.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProfilePage
