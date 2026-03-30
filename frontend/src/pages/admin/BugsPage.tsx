import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bug, CheckCircle, Circle, Trash2, ExternalLink, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import { client } from '../../api/client'

interface BugItem {
  id: string
  description: string
  screenshot_url: string | null
  page_url: string | null
  reporter_name: string
  is_fixed: boolean
  admin_note: string | null
  created_at: string
}

const BugsPage: React.FC = () => {
  const queryClient = useQueryClient()

  const { data: bugs, isLoading } = useQuery<BugItem[]>({
    queryKey: ['admin-bugs'],
    queryFn: async () => {
      const { data } = await client.get('/api/admin/bugs')
      return data
    },
  })

  const handleToggle = async (bug: BugItem) => {
    try {
      await client.patch(`/api/admin/bugs/${bug.id}`)
      await queryClient.invalidateQueries({ queryKey: ['admin-bugs'] })
      toast.success(bug.is_fixed ? 'Отмечен как открытый' : 'Отмечен как исправленный')
    } catch {
      toast.error('Ошибка')
    }
  }

  const handleDelete = async (bug: BugItem) => {
    if (!confirm('Удалить баг-репорт?')) return
    try {
      await client.delete(`/api/admin/bugs/${bug.id}`)
      await queryClient.invalidateQueries({ queryKey: ['admin-bugs'] })
      toast.success('Удалён')
    } catch {
      toast.error('Ошибка')
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const openCount = bugs?.filter((b) => !b.is_fixed).length ?? 0
  const fixedCount = bugs?.filter((b) => b.is_fixed).length ?? 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-th-text flex items-center gap-2">
          <Bug size={24} />
          Баги
        </h1>
        <p className="text-th-text-2 text-sm mt-1">
          {openCount > 0 && <span className="text-red-400 font-medium">{openCount} открытых</span>}
          {openCount > 0 && fixedCount > 0 && ' · '}
          {fixedCount > 0 && <span className="text-green-400">{fixedCount} исправлено</span>}
          {!bugs?.length && 'Нет баг-репортов'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-th-surface border border-th-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !bugs || bugs.length === 0 ? (
        <div className="bg-th-surface border border-th-border rounded-lg p-12 text-center text-th-text-2">
          <Bug size={40} className="mx-auto mb-3 opacity-30" />
          <p>Нет баг-репортов</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bugs.map((bug) => (
            <div
              key={bug.id}
              className={`bg-th-surface border rounded-lg p-4 transition-colors ${
                bug.is_fixed ? 'border-green-800/30 opacity-60' : 'border-th-border'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(bug)}
                  className={`mt-0.5 shrink-0 transition-colors ${
                    bug.is_fixed ? 'text-green-400 hover:text-green-300' : 'text-th-text-3 hover:text-[#FF6B00]'
                  }`}
                  title={bug.is_fixed ? 'Открыть снова' : 'Отметить исправленным'}
                >
                  {bug.is_fixed ? <CheckCircle size={20} /> : <Circle size={20} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-th-text text-sm ${bug.is_fixed ? 'line-through opacity-70' : ''}`}>
                    {bug.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-th-text-3">
                    <span>{bug.reporter_name}</span>
                    <span>{formatDate(bug.created_at)}</span>
                    {bug.page_url && (
                      <a
                        href={bug.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF6B00] hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink size={10} />
                        Страница
                      </a>
                    )}
                    {bug.screenshot_url && (
                      <a
                        href={bug.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF6B00] hover:underline flex items-center gap-0.5"
                      >
                        <Image size={10} />
                        Скриншот
                      </a>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(bug)}
                  className="shrink-0 p-1.5 text-th-text-3 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BugsPage
