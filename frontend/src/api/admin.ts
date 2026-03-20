import { client } from './client'
import type { User, Workshop, AppSettings, DashboardStats } from '../types'

// Users
export interface UserFilters {
  search?: string
  role?: string
  is_active?: string  // 'true' | 'false'
}

export const getUsers = async (filters?: UserFilters): Promise<User[]> => {
  const params: Record<string, string> = {}
  if (filters?.search) params.search = filters.search
  if (filters?.role) params.role = filters.role
  if (filters?.is_active) params.is_active = filters.is_active
  const response = await client.get<User[]>('/api/admin/users', { params })
  return response.data
}

export interface CreateUserData {
  email: string
  password: string
  name: string
  role: string
  workshop_id?: string
  city?: string
  phone?: string
  gender?: string
}

export interface UpdateUserData {
  email?: string
  name?: string
  role?: string
  workshop_id?: string | null
  is_active?: boolean
  password?: string
  city?: string
  phone?: string
  gender?: string
}

export const createUser = async (data: CreateUserData): Promise<User> => {
  const response = await client.post<User>('/api/admin/users', data)
  return response.data
}

export const updateUser = async (id: string, data: UpdateUserData): Promise<User> => {
  const response = await client.patch<User>(`/api/admin/users/${id}`, data)
  return response.data
}

export const deleteUser = async (id: string): Promise<void> => {
  await client.delete(`/api/admin/users/${id}`)
}

export const resetUserPassword = async (id: string): Promise<{ new_password: string }> => {
  const response = await client.post<{ new_password: string }>(`/api/admin/users/${id}/reset-password`)
  return response.data
}

// Builds (admin)
export interface AdminBuildListItem {
  id: string
  short_code: string
  title: string
  author_name: string
  author_avatar: string | null
  author_id: string | null
  workshop_name: string | null
  is_public: boolean
  has_password: boolean
  total_price: number
  items_count: number
  tags: string[]
  created_at: string
}

export const getAdminBuilds = async (params: {
  page?: number
  per_page?: number
  search?: string
}): Promise<{ items: AdminBuildListItem[]; total: number; page: number; per_page: number }> => {
  const response = await client.get('/api/admin/builds', { params })
  return response.data
}

export const deleteAdminBuild = async (id: string): Promise<void> => {
  await client.delete(`/api/admin/builds/${id}`)
}

// Export
export const exportUsersCSV = () => {
  return `${client.defaults.baseURL || ''}/api/admin/export/users-csv`
}

export const exportBuildsCSV = () => {
  return `${client.defaults.baseURL || ''}/api/admin/export/builds-csv`
}

// Logo upload
export const uploadLogo = async (type: 'header' | 'pdf', file: File): Promise<{ url: string }> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post<{ url: string }>(`/api/admin/upload-logo/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

// Workshops
export const getWorkshops = async (): Promise<Workshop[]> => {
  const response = await client.get<Workshop[]>('/api/admin/workshops')
  return response.data
}

export interface WorkshopData {
  name: string
  city: string
}

export const createWorkshop = async (data: WorkshopData): Promise<Workshop> => {
  const response = await client.post<Workshop>('/api/admin/workshops', data)
  return response.data
}

export const updateWorkshop = async (id: string, data: WorkshopData): Promise<Workshop> => {
  const response = await client.put<Workshop>(`/api/admin/workshops/${id}`, data)
  return response.data
}

export const deleteWorkshop = async (id: string): Promise<void> => {
  await client.delete(`/api/admin/workshops/${id}`)
}

// Settings
export const getSettings = async (): Promise<AppSettings> => {
  const response = await client.get<{ settings: AppSettings }>('/api/admin/settings')
  return response.data.settings
}

export const updateSettings = async (data: Partial<AppSettings>): Promise<AppSettings> => {
  const response = await client.patch<{ settings: AppSettings }>('/api/admin/settings', data)
  return response.data.settings
}

// Banners
export interface AdminBanner {
  id: string
  title: string
  text: string | null
  button_text: string | null
  button_url: string | null
  button_color: string | null
  button2_text: string | null
  button2_url: string | null
  button2_color: string | null
  position: number
  is_active: boolean
  created_at?: string
}

export const getAdminBanners = async (): Promise<AdminBanner[]> => {
  const response = await client.get<AdminBanner[]>('/api/admin/banners')
  return response.data
}

export const createBanner = async (data: Partial<AdminBanner>): Promise<AdminBanner> => {
  const response = await client.post<AdminBanner>('/api/admin/banners', data)
  return response.data
}

export const updateBanner = async (id: string, data: Partial<AdminBanner>): Promise<AdminBanner> => {
  const response = await client.put<AdminBanner>(`/api/admin/banners/${id}`, data)
  return response.data
}

export const deleteBanner = async (id: string): Promise<void> => {
  await client.delete(`/api/admin/banners/${id}`)
}

// Dashboard
export const getDashboard = async (): Promise<DashboardStats> => {
  const response = await client.get<DashboardStats>('/api/admin/dashboard')
  return response.data
}

export const getActivity = async (): Promise<DashboardStats['masters_activity']> => {
  const response = await client.get<DashboardStats['masters_activity']>('/api/admin/activity')
  return response.data
}

// Comments
export interface AdminComment {
  id: string
  text: string
  author_name: string
  author_avatar: string | null
  build_code: string
  build_title: string | null
  is_hidden: boolean
  created_at: string
}

export const getAdminComments = async (
  page: number,
  perPage: number
): Promise<{ items: AdminComment[]; total: number; page: number; per_page: number }> => {
  const response = await client.get('/api/admin/comments', {
    params: { page, per_page: perPage },
  })
  return response.data
}

export const toggleHideComment = async (id: string): Promise<void> => {
  await client.post(`/api/admin/comments/${id}/toggle-hide`)
}

export const deleteAdminComment = async (id: string): Promise<void> => {
  await client.delete(`/api/admin/comments/${id}`)
}

// Backups
export interface BackupItem {
  name: string
  size: number
  created_at: string
}

export const getBackups = async (): Promise<BackupItem[]> => {
  const response = await client.get<BackupItem[]>('/api/admin/db/backups')
  return response.data
}

export const createBackup = async (): Promise<{ filename: string }> => {
  const response = await client.post<{ filename: string }>('/api/admin/db/backup')
  return response.data
}

export const restoreBackup = async (filename: string): Promise<void> => {
  await client.post(`/api/admin/db/restore/${filename}`)
}

export const deleteBackup = async (filename: string): Promise<void> => {
  await client.delete(`/api/admin/db/backup/${filename}`)
}
