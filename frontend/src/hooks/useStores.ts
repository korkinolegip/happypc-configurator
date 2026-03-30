import { useQuery } from '@tanstack/react-query'
import { getStores } from '../api/builds'
import type { StoreInfo } from '../types'

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
    staleTime: 5 * 60 * 1000,
  })
}

export function detectStoreFromList(url: string, stores: StoreInfo[]): StoreInfo | null {
  if (!url) return null
  const u = url.toLowerCase()
  for (const store of stores) {
    for (const pattern of store.url_patterns) {
      if (u.includes(pattern.toLowerCase())) return store
    }
  }
  return null
}
