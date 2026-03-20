import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Trash2, Eye, EyeOff, ChevronLeft, ChevronRight, MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminComments, toggleHideComment, deleteAdminComment } from '../../api/admin'

const CommentsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState<string | null>(null)
  const perPage = 20

  const { data, isLoading } = useQuery({
    queryKey: ['admin-comments', page],
    queryFn: () => getAdminComments(page, perPage),
  })

  const handleToggleHide = async (id: string) => {
    setActionId(id)
    try {
      await toggleHideComment(id)
      await queryClient.invalidateQueries({ queryKey: ['admin-comments'] })
      toast.success('Статус комментария обновлён')
    } catch {
      toast.error('Ошибка при обновлении')
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить комментарий? Это действие нельзя отменить.')) return
    setActionId(id)
    try {
      await deleteAdminComment(id)
      await queryClient.invalidateQueries({ queryKey: ['admin-comments'] })
      toast.success('Комментарий удалён')
    } catch {
      toast.error('Ошибка при удалении')
    } finally {
      setActionId(null)
    }
  }

  const totalPages = data ? Math.ceil(data.total / perPage) : 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-th-text">Комментарии</h1>
        <p className="text-th-text-2 text-sm mt-1">
          {data ? `${data.total} комментариев` : 'Загрузка...'}
        </p>
      </div>

      <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-th-surface-2 rounded animate-pulse" />
            ))}
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-12 text-center text-th-text-2">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p>Комментариев пока нет</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">Автор</th>
                  <th className="table-header text-left">Комментарий</th>
                  <th className="table-header text-left hidden md:table-cell">Сборка</th>
                  <th className="table-header text-left hidden lg:table-cell">Дата</th>
                  <th className="table-header text-center">Статус</th>
                  <th className="table-header text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((comment) => (
                  <tr
                    key={comment.id}
                    className={`border-b border-th-border last:border-0 hover:bg-th-surface-2 transition-colors ${
                      comment.is_hidden ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {comment.author_avatar ? (
                          <img
                            src={comment.author_avatar}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-th-surface-2 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-th-text-2">
                              {comment.author_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                        <span className="text-th-text text-sm truncate max-w-[120px]">
                          {comment.author_name}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell text-th-text text-sm max-w-[300px]">
                      <p className="truncate">{comment.text}</p>
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      <Link
                        to={`/b/${comment.build_code}`}
                        className="text-[#FF6B00] hover:underline text-sm"
                      >
                        <span className="font-mono">{comment.build_code}</span>
                        {comment.build_title && (
                          <span className="text-th-text-2 ml-1.5 hidden xl:inline">
                            {comment.build_title}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="table-cell text-th-text-2 text-xs hidden lg:table-cell whitespace-nowrap">
                      {new Date(comment.created_at).toLocaleDateString('ru-RU')}{' '}
                      {new Date(comment.created_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="table-cell text-center">
                      {comment.is_hidden ? (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-500">
                          <EyeOff size={12} /> Скрыт
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <Eye size={12} /> Виден
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleHide(comment.id)}
                          disabled={actionId === comment.id}
                          className="p-1.5 text-th-text-2 hover:text-th-text hover:bg-th-surface-2 rounded transition-colors"
                          title={comment.is_hidden ? 'Показать' : 'Скрыть'}
                        >
                          {actionId === comment.id ? (
                            <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                          ) : comment.is_hidden ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          disabled={actionId === comment.id}
                          className="p-1.5 text-th-text-2 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Удалить"
                        >
                          {actionId === comment.id ? (
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
            className="p-2 text-th-text-2 hover:text-th-text disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-th-text-2 text-sm">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 text-th-text-2 hover:text-th-text disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default CommentsPage
