import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { client } from '../../api/client'

interface PermissionsData {
  roles: string[]
  permissions: string[]
  labels: Record<string, string>
  matrix: Record<string, Record<string, boolean>>
}

const ROLE_NAMES: Record<string, string> = {
  user: 'Пользователь',
  master: 'Мастер',
  admin: 'Администратор',
  superadmin: 'Суперадмин',
}

const PermissionsPage: React.FC = () => {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const resp = await client.get<PermissionsData>('/api/permissions/all')
      return resp.data
    },
  })

  const handleToggle = async (role: string, permission: string, currentValue: boolean) => {
    try {
      await client.put('/api/permissions/update', {
        role,
        permission,
        enabled: !currentValue,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-permissions'] })
      toast.success('Разрешение обновлено')
    } catch {
      toast.error('Ошибка')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-th-surface-2 rounded animate-pulse w-40" />
        <div className="h-96 bg-th-surface border border-th-border rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-th-text flex items-center gap-2">
          <Shield size={24} />
          Разрешения ролей
        </h1>
        <p className="text-th-text-2 text-sm mt-1">
          Настройка доступа к функциям для каждой роли пользователей
        </p>
      </div>

      <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left w-64">Функция</th>
                {data.roles.map(role => (
                  <th key={role} className="table-header text-center w-32">
                    {ROLE_NAMES[role] || role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.permissions.map(perm => (
                <tr key={perm} className="border-b border-th-border last:border-0 hover:bg-th-surface-2 transition-colors">
                  <td className="table-cell text-th-text text-sm font-medium">
                    {data.labels[perm] || perm}
                  </td>
                  {data.roles.map(role => {
                    const enabled = data.matrix[role]?.[perm] ?? false
                    return (
                      <td key={role} className="table-cell text-center">
                        <button
                          onClick={() => handleToggle(role, perm, enabled)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                            enabled
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-red-500/10 text-red-400/50 hover:bg-red-500/20'
                          }`}
                          title={enabled ? 'Включено — нажмите чтобы отключить' : 'Отключено — нажмите чтобы включить'}
                        >
                          {enabled ? <Check size={16} strokeWidth={3} /> : <X size={16} />}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-th-muted text-xs">
        Изменения применяются мгновенно. Суперадмин всегда имеет полный доступ.
      </p>
    </div>
  )
}

export default PermissionsPage
