import { client } from './client'
import type { AuthResponse, User, LoginRequest, RegisterRequest } from '../types'

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await client.post<AuthResponse>('/api/auth/login', data)
  return response.data
}

export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  const response = await client.post<AuthResponse>('/api/auth/register', data)
  return response.data
}

export const telegramCallback = async (queryParams: Record<string, string>): Promise<AuthResponse> => {
  const response = await client.post<AuthResponse>('/api/auth/telegram', queryParams)
  return response.data
}

export const vkCallback = async (code: string): Promise<AuthResponse> => {
  const response = await client.post<AuthResponse>('/api/auth/vk', { code })
  return response.data
}

export const getMe = async (): Promise<User> => {
  const response = await client.get<User>('/api/auth/me')
  return response.data
}

export const logout = async (): Promise<void> => {
  try {
    await client.post('/api/auth/logout')
  } catch {
    // Ignore logout errors
  } finally {
    localStorage.removeItem('token')
  }
}

export const updateProfile = async (data: FormData): Promise<User> => {
  // If FormData contains 'avatar', upload to /api/profile/avatar
  // If it contains 'name', update profile via PUT /api/profile
  if (data.has('avatar')) {
    const response = await client.post<{ avatar_url: string }>('/api/profile/avatar', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    // Return current user with updated avatar
    const meResp = await client.get<User>('/api/auth/me')
    return meResp.data
  } else {
    const name = data.get('name') as string | null
    const response = await client.put<User>('/api/profile', name ? { name } : {})
    return response.data
  }
}
