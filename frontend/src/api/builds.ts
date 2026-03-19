import { client } from './client'
import type { Build, BuildListItem, PaginatedResponse } from '../types'

export const getPublicSettings = async (): Promise<Record<string, string>> => {
  const response = await client.get('/api/public/settings')
  return response.data
}

export const getPublicBuilds = async (filters?: BuildFilters): Promise<PaginatedResponse<BuildListItem>> => {
  const response = await client.get('/api/public/builds', { params: filters })
  return response.data
}

export interface BuildFilters {
  workshop_id?: string
  author?: string
  sort?: 'newest' | 'oldest'
  page?: number
  per_page?: number
}

export interface BuildCreateData {
  title: string
  description?: string
  is_public: boolean
  password?: string
  labor_percent: number
  labor_price_manual?: number | null
  items: {
    category: string
    name: string
    url?: string
    price: number
    sort_order: number
  }[]
}

export const getBuilds = async (filters?: BuildFilters): Promise<PaginatedResponse<BuildListItem>> => {
  const params = new URLSearchParams()
  if (filters?.workshop_id) params.set('workshop_id', filters.workshop_id)
  if (filters?.author) params.set('author', filters.author)
  if (filters?.sort) params.set('sort', filters.sort)
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.per_page) params.set('per_page', String(filters.per_page))
  const response = await client.get<PaginatedResponse<BuildListItem>>(`/api/builds?${params.toString()}`)
  return response.data
}

export const createBuild = async (data: BuildCreateData): Promise<Build> => {
  const response = await client.post<Build>('/api/builds', data)
  return response.data
}

export const getBuild = async (id: string): Promise<Build> => {
  const response = await client.get<Build>(`/api/builds/${id}`)
  return response.data
}

export const updateBuild = async (id: string, data: Partial<BuildCreateData>): Promise<Build> => {
  const response = await client.put<Build>(`/api/builds/${id}`, data)
  return response.data
}

export const deleteBuild = async (id: string): Promise<void> => {
  await client.delete(`/api/builds/${id}`)
}

export const copyBuild = async (id: string): Promise<Build> => {
  const response = await client.post<Build>(`/api/builds/${id}/copy`)
  return response.data
}

export const getPublicBuild = async (short_code: string, password?: string): Promise<Build> => {
  const params = new URLSearchParams()
  if (password) params.set('password', password)
  const response = await client.get<Build>(`/api/public/${short_code}?${params.toString()}`)
  return response.data
}

export const downloadPDF = async (short_code: string): Promise<void> => {
  const response = await client.get(`/api/public/${short_code}/pdf`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `build-${short_code}.pdf`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const getMyBuilds = async (): Promise<PaginatedResponse<BuildListItem>> => {
  const response = await client.get<PaginatedResponse<BuildListItem>>('/api/builds?my=true&per_page=100')
  return response.data
}

export interface ParsedUrlResult {
  name?: string
  price?: number
  store?: string
}

export const parseProductUrl = async (url: string): Promise<ParsedUrlResult> => {
  const response = await client.post<ParsedUrlResult>('/api/public/parse-url', { url })
  return response.data
}
