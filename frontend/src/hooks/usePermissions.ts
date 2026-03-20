import { useQuery } from '@tanstack/react-query'
import { client } from '../api/client'
import { useAuth } from './useAuth'

export type Permissions = Record<string, boolean>

const fetchMyPermissions = async (): Promise<Permissions> => {
  const response = await client.get<Permissions>('/api/permissions/my')
  return response.data
}

export const usePermissions = () => {
  const { isAuthenticated } = useAuth()

  const { data: permissions } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: fetchMyPermissions,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const can = (perm: string): boolean => {
    if (!permissions) return true // default allow while loading
    return permissions[perm] ?? true
  }

  return { permissions, can }
}
