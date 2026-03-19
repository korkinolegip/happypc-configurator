import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

export const client = axios.create({ baseURL: API_URL })

// Add JWT to all requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — только удаляем токен, редирект на логин делает ProtectedRoute
client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
    }
    return Promise.reject(err)
  }
)
