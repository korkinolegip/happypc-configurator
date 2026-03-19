export interface User {
  id: string
  email: string | null
  name: string
  avatar_url: string | null
  role: 'superadmin' | 'admin' | 'master' | 'user'
  workshop_id: string | null
  workshop_name: string | null
  gender: string | null
  city: string | null
  phone: string | null
  telegram_username: string | null
  vk_url: string | null
  is_active: boolean
  created_at: string
}

export interface BuildItem {
  id: string
  category: string
  name: string
  url: string | null
  price: number
  sort_order: number
}

export interface Build {
  id: string
  short_code: string
  title: string
  description: string | null
  author: { id: string; name: string; avatar_url: string | null }
  workshop: { id: string; name: string; city: string } | null
  is_public: boolean
  has_password: boolean
  items: BuildItem[]
  total_price: number
  hardware_total?: number
  labor_cost?: number
  labor_percent: number
  labor_price_manual: number | null
  created_at: string
  updated_at: string
}

export interface BuildListItem {
  id: string
  short_code: string
  title: string
  author_name: string
  author_avatar: string | null
  author_id: string
  workshop_name: string | null
  city: string | null
  total_price: number
  items_count: number
  tags: string[]
  created_at: string
}

export interface Workshop {
  id: string
  name: string
  city: string
  masters_count: number
  builds_count: number
  created_at: string
}

export interface AppSettings {
  registration_enabled: string
  public_feed_enabled: string
  default_labor_percent: string
  company_name: string
  telegram_bot_name?: string
  vk_client_id?: string
  pdf_footer_text?: string
  header_logo_url?: string
  pdf_logo_url?: string
  [key: string]: string | undefined
}

export interface DashboardStats {
  users_count: number
  builds_count: number
  workshops_count: number
  recent_builds: BuildListItem[]
  masters_activity: MasterActivity[]
}

export interface MasterActivity {
  id: string
  name: string
  avatar_url: string | null
  workshop_name: string | null
  builds_count: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  phone: string
  gender: 'male' | 'female'
  city?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export type UserRole = 'superadmin' | 'admin' | 'master' | 'user'
