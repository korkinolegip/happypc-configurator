import { client } from './client'
import type { User, Workshop, AppSettings, DashboardStats } from '../types'

// Users
export const getUsers = async (): Promise<User[]> => {
  const response = await client.get<User[]>('/api/admin/users')
  return response.data
}

export interface CreateUserData {
  email: string
  password: string
  name: string
  role: string
  workshop_id?: string
}

export interface UpdateUserData {
  email?: string
  name?: string
  role?: string
  workshop_id?: string | null
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
  const response = await client.patch<Workshop>(`/api/admin/workshops/${id}`, data)
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

// Dashboard
export const getDashboard = async (): Promise<DashboardStats> => {
  const response = await client.get<DashboardStats>('/api/admin/dashboard')
  return response.data
}

export const getActivity = async (): Promise<DashboardStats['masters_activity']> => {
  const response = await client.get<DashboardStats['masters_activity']>('/api/admin/activity')
  return response.data
}
