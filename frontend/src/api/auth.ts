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

export const updateProfile = async (data: FormData | Record<string, unknown>): Promise<User> => {
  if (data instanceof FormData && data.has('avatar')) {
    await client.post<{ avatar_url: string }>('/api/profile/avatar', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const meResp = await client.get<User>('/api/auth/me')
    return meResp.data
  } else {
    const payload = data instanceof FormData
      ? Object.fromEntries(data.entries())
      : data
    const response = await client.put<User>('/api/profile', payload)
    return response.data
  }
}

export const changePassword = async (data: {
  old_password: string
  new_password: string
  confirm_password: string
}): Promise<{ message: string }> => {
  const response = await client.post<{ message: string }>('/api/profile/change-password', data)
  return response.data
}

export const verifyEmail = async (code: string): Promise<User> => {
  const response = await client.post<User>('/api/auth/verify-email', { code })
  return response.data
}

export const resendVerification = async (): Promise<void> => {
  await client.post('/api/auth/resend-verification')
}
