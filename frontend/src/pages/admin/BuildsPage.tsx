import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Trash2, ExternalLink, Eye, EyeOff, Lock, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminBuilds, deleteAdminBuild } from '../../api/admin'

const BuildsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const perPage = 20

  const { data, isLoading } = useQuery({
    queryKey: ['admin-builds', search, page],
    queryFn: () => getAdminBuilds({ page, per_page: perPage, search: search || undefined }),
  })

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить сборку «${title}»? Это действие нельзя отменить.`)) return
    setDeletingId(id)
    try {
      await deleteAdminBuild(id)
      await queryClient.invalidateQueries({ queryKey: ['admin-builds'] })
      toast.success('Сборка удалена')
    } catch {
      toast.error('Ошибка при удалении')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = data ? Math.ceil(data.total / perPage) : 0

  const formatPrice = (price: number) =>
    price.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Сборки</h1>
        <p className="text-[#AAAAAA] text-sm mt-1">
          {data ? `${data.total} сборок` : 'Загрузка...'}
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="input-field pl-9"
          placeholder="Поиск по названию, коду, автору..."
        />
      </div>

      <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-[#2A2A2A] rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">Код</th>
                  <th className="table-header text-left">Название</th>
                  <th className="table-header text-left hidden sm:table-cell">Автор</th>
                  <th className="table-header text-left hidden md:table-cell">Мастерская</th>
                  <th className="table-header text-right hidden sm:table-cell">Цена</th>
                  <th className="table-header text-center">Статус</th>
                  <th className="table-header text-left hidden lg:table-cell">Дата</th>
                  <th className="table-header text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((build) => (
                  <tr key={build.id} className="border-b border-[#2A2A2A] last:border-0 hover:bg-[#1A1A1A] transition-colors">
                    <td className="table-cell">
                      <Link
                        to={`/b/${build.short_code}`}
                        className="text-[#FF6B00] hover:underline font-mono text-sm"
                      >
                        {build.short_code}
                      </Link>
                    </td>
                    <td className="table-cell text-white text-sm max-w-[200px] truncate">{build.title}</td>
                    <td className="table-cell text-[#AAAAAA] text-sm hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        {build.author_avatar ? (
                          <img src={build.author_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : null}
                        {build.author_name}
                      </div>
                    </td>
                    <td className="table-cell text-[#AAAAAA] text-sm hidden md:table-cell">{build.workshop_name || '—'}</td>
                    <td className="table-cell text-white text-sm text-right hidden sm:table-cell font-medium">
                      {formatPrice(build.total_price)}
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-1">
                        {build.is_public ? (
                          <Eye size={14} className="text-green-400" />
                        ) : (
                          <EyeOff size={14} className="text-[#555555]" />
                        )}
                        {build.has_password && <Lock size={12} className="text-yellow-500" />}
                      </div>
                    </td>
                    <td className="table-cell text-[#AAAAAA] text-xs hidden lg:table-cell">
                      {new Date(build.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/b/${build.short_code}`}
                          className="p-1.5 text-[#AAAAAA] hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
                          title="Открыть"
                        >
                          <ExternalLink size={14} />
                        </Link>
                        <button
                          onClick={() => handleDelete(build.id, build.title)}
                          disabled={deletingId === build.id}
                          className="p-1.5 text-[#AAAAAA] hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Удалить"
                        >
                          {deletingId === build.id ? (
                            <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 text-[#AAAAAA] hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-[#AAAAAA] text-sm">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 text-[#AAAAAA] hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default BuildsPage
