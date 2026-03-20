import { client } from './client'

// Stats
export interface BuildStats {
  views: number
  likes: number
  comments: number
}

export const getBuildStats = async (buildId: string): Promise<BuildStats> => {
  const response = await client.get<BuildStats>(`/api/social/${buildId}/stats`)
  return response.data
}

export const recordView = async (buildId: string): Promise<void> => {
  await client.post(`/api/social/${buildId}/view`)
}

// Likes
export const toggleLike = async (buildId: string): Promise<{ liked: boolean; count: number }> => {
  const response = await client.post<{ liked: boolean; count: number }>(`/api/social/${buildId}/like`)
  return response.data
}

export const checkLiked = async (buildId: string): Promise<boolean> => {
  const response = await client.get<{ liked: boolean }>(`/api/social/${buildId}/liked`)
  return response.data.liked
}

// Comments
export interface Comment {
  id: string
  text: string
  user_id: string
  user_name: string
  user_avatar: string | null
  created_at: string
  replies: Comment[]
}

export const getComments = async (buildId: string): Promise<Comment[]> => {
  const response = await client.get<Comment[]>(`/api/social/${buildId}/comments`)
  return response.data
}

export const createComment = async (buildId: string, text: string, parentId?: string): Promise<Comment> => {
  const response = await client.post<Comment>(`/api/social/${buildId}/comments`, {
    text,
    parent_id: parentId || null,
  })
  return response.data
}

// Recent comments (sidebar)
export interface RecentComment {
  id: string
  text: string
  user_name: string
  user_avatar: string | null
  build_code: string
  build_title: string
  created_at: string
}

export const getRecentComments = async (limit = 5): Promise<RecentComment[]> => {
  const response = await client.get<RecentComment[]>('/api/social/recent-comments', { params: { limit } })
  return response.data
}

// Tags
export interface PopularTag {
  name: string
  count: number
}

export const getPopularTags = async (limit = 20): Promise<PopularTag[]> => {
  const response = await client.get<PopularTag[]>('/api/social/tags/popular', { params: { limit } })
  return response.data
}
