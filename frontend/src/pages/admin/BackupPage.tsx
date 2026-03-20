import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download, RotateCcw, Plus, Database, HardDrive, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getBackups, createBackup, restoreBackup, deleteBackup } from '../../api/admin'
import { client } from '../../api/client'

const BackupPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [restoringFile, setRestoringFile] = useState<string | null>(null)

  const { data: backups, isLoading } = useQuery({
    queryKey: ['admin-backups'],
    queryFn: getBackups,
  })

  const handleCreate = async () => {
    setCreating(true)
    try {
      await createBackup()
      await queryClient.invalidateQueries({ queryKey: ['admin-backups'] })
      toast.success('Бэкап создан')
    } catch {
      toast.error('Ошибка при создании бэкапа')
    } finally {
      setCreating(false)
    }
  }

  const handleDownload = (filename: string) => {
    const baseURL = client.defaults.baseURL || ''
    const token = localStorage.getItem('token')
    const url = `${baseURL}/api/admin/db/backup/${filename}?token=${token}`
    window.open(url, '_blank')
  }

  const handleRestore = async (filename: string) => {
    if (
      !confirm(
        `Восстановить базу данных из бэкапа «${filename}»?\n\nВнимание: текущие данные будут заменены данными из бэкапа. Рекомендуется сначала создать бэкап текущего состояния.`
      )
    )
      return

    setRestoringFile(filename)
    try {
      await restoreBackup(filename)
      toast.success('База данных восстановлена из бэкапа')
    } catch {
      toast.error('Ошибка при восстановлении')
    } finally {
      setRestoringFile(null)
    }
  }

  const handleDelete = async (filename: string) => {
    if (!confirm(`Удалить бэкап «${filename}»?`)) return
    try {
      await deleteBackup(filename)
      await queryClient.invalidateQueries({ queryKey: ['admin-backups'] })
      toast.success('Бэкап удалён')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка удаления')
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-text">Бэкапы</h1>
          <p className="text-th-text-2 text-sm mt-1">
            Управление резервными копиями базы данных
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] hover:bg-[#e65f00] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {creating ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          Создать бэкап
        </button>
      </div>

      <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-th-surface-2 rounded animate-pulse" />
            ))}
          </div>
        ) : !backups || backups.length === 0 ? (
          <div className="p-12 text-center text-th-text-2">
            <Database size={40} className="mx-auto mb-3 opacity-30" />
            <p>Бэкапов пока нет</p>
            <p className="text-xs mt-1">Нажмите «Создать бэкап», чтобы создать первый</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">
                    <div className="flex items-center gap-2">
                      <HardDrive size={14} />
                      Файл
                    </div>
                  </th>
                  <th className="table-header text-left hidden sm:table-cell">Размер</th>
                  <th className="table-header text-left hidden sm:table-cell">Дата</th>
                  <th className="table-header text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr
                    key={backup.name}
                    className="border-b border-th-border last:border-0 hover:bg-th-surface-2 transition-colors"
                  >
                    <td className="table-cell">
                      <span className="text-th-text text-sm font-mono">{backup.name}</span>
                    </td>
                    <td className="table-cell text-th-text-2 text-sm hidden sm:table-cell">
                      {formatSize(backup.size)}
                    </td>
                    <td className="table-cell text-th-text-2 text-sm hidden sm:table-cell whitespace-nowrap">
                      {new Date(backup.created_at).toLocaleDateString('ru-RU')}{' '}
                      {new Date(backup.created_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(backup.name)}
                          className="p-1.5 text-th-text-2 hover:text-th-text hover:bg-th-surface-2 rounded transition-colors"
                          title="Скачать"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleRestore(backup.name)}
                          disabled={restoringFile === backup.name}
                          className="p-1.5 text-th-text-2 hover:text-yellow-400 hover:bg-yellow-900/20 rounded transition-colors"
                          title="Восстановить"
                        >
                          {restoringFile === backup.name ? (
                            <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <RotateCcw size={14} />
                          )}
                        </button>
                        {/* Delete — disabled for last 3 */}
                        {backups && backups.indexOf(backup) >= 3 && (
                          <button
                            onClick={() => handleDelete(backup.name)}
                            className="p-1.5 text-th-text-2 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default BackupPage
