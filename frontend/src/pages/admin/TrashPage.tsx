import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, RotateCcw, AlertTriangle, User, Monitor } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTrash, restoreFromTrash, deleteFromTrash, clearAllTrash } from '../../api/admin'

interface TrashItem {
  id: string
  user_name: string
  user_email: string
  user_role: string
  builds_count: number
  deleted_by_name: string
  reason: string | null
  deleted_at: string
}

const TrashPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const { data: items, isLoading } = useQuery<TrashItem[]>({
    queryKey: ['admin-trash'],
    queryFn: getTrash,
  })

  const handleRestore = async (item: TrashItem) => {
    if (!confirm(`Восстановить пользователя «${item.user_name}» и ${item.builds_count} сборок?`)) return
    setRestoringId(item.id)
    try {
      const result = await restoreFromTrash(item.id)
      await queryClient.invalidateQueries({ queryKey: ['admin-trash'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(result.message || 'Пользователь восстановлен')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка восстановления')
    } finally {
      setRestoringId(null)
    }
  }

  const handlePermanentDelete = async (item: TrashItem) => {
    if (!confirm(`Удалить навсегда «${item.user_name}»? Восстановление будет невозможно.`)) return
    try {
      await deleteFromTrash(item.id)
      await queryClient.invalidateQueries({ queryKey: ['admin-trash'] })
      toast.success('Удалено из корзины')
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Очистить всю корзину? Все данные будут удалены безвозвратно.')) return
    setClearing(true)
    try {
      await clearAllTrash()
      await queryClient.invalidateQueries({ queryKey: ['admin-trash'] })
      toast.success('Корзина очищена')
    } catch {
      toast.error('Ошибка очистки')
    } finally {
      setClearing(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-text">Корзина</h1>
          <p className="text-th-text-2 text-sm mt-1">
            Удалённые пользователи и их сборки
          </p>
        </div>
        {items && items.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
            Очистить всё
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-th-surface border border-th-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="bg-th-surface border border-th-border rounded-lg p-12 text-center text-th-text-2">
          <Trash2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Корзина пуста</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-th-surface border border-th-border rounded-lg p-4 sm:p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User size={16} className="text-th-text-2 shrink-0" />
                    <span className="text-th-text font-semibold truncate">{item.user_name}</span>
                    <span className="text-th-text-3 text-xs px-1.5 py-0.5 bg-th-surface-2 rounded">{item.user_role}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-th-text-3">
                    {item.user_email && <span>{item.user_email}</span>}
                    <span className="flex items-center gap-1">
                      <Monitor size={11} /> {item.builds_count} сборок
                    </span>
                    <span>Удалил: {item.deleted_by_name}</span>
                    <span>{formatDate(item.deleted_at)}</span>
                  </div>
                  {item.reason && (
                    <p className="text-th-text-2 text-xs mt-2 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5 text-amber-500" />
                      {item.reason}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={restoringId === item.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {restoringId === item.id ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    Восстановить
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/20 border border-red-400/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TrashPage
