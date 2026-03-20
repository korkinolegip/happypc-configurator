import { client } from './client'
import type { Build, BuildListItem, PaginatedResponse } from '../types'

export const getPublicSettings = async (): Promise<Record<string, string>> => {
  const response = await client.get('/api/public/settings')
  return response.data
}

export const getPublicBuilds = async (filters?: BuildFilters): Promise<PaginatedResponse<BuildListItem>> => {
  const params: Record<string, string> = {}
  if (filters?.workshop_id) params.workshop_id = filters.workshop_id
  if (filters?.author_id) params.author_id = filters.author_id
  if (filters?.city) params.city = filters.city
  if (filters?.price_from) params.price_from = String(filters.price_from)
  if (filters?.price_to) params.price_to = String(filters.price_to)
  if (filters?.tag) params.tag = filters.tag
  if (filters?.search) params.search = filters.search
  if (filters?.sort) params.sort = filters.sort
  if (filters?.page) params.page = String(filters.page)
  if (filters?.per_page) params.per_page = String(filters.per_page)
  const response = await client.get('/api/public/builds', { params })
  return response.data
}

export interface BuildFilters {
  workshop_id?: string
  author?: string
  author_id?: string
  city?: string
  price_from?: number
  price_to?: number
  tag?: string
  search?: string
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc'
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
  if (filters?.author_id) params.set('author_id', filters.author_id)
  if (filters?.city) params.set('city', filters.city)
  if (filters?.price_from) params.set('price_from', String(filters.price_from))
  if (filters?.price_to) params.set('price_to', String(filters.price_to))
  if (filters?.tag) params.set('tag', filters.tag)
  if (filters?.search) params.set('search', filters.search)
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

// Banners
export interface BannerItem {
  id: string
  title: string
  text: string | null
  button_text: string | null
  button_url: string | null
  position: number
}

export const getPublicBanners = async (): Promise<BannerItem[]> => {
  const response = await client.get<BannerItem[]>('/api/public/banners')
  return response.data
}

export interface CityItem {
  name: string
  code?: string
}

export const getCities = async (withBuilds = false): Promise<CityItem[]> => {
  const params = withBuilds ? { with_builds: 'true' } : {}
  const response = await client.get<CityItem[]>('/api/public/cities', { params })
  return response.data
}
