import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Camera, Plus, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { updateProfile } from '../api/auth'
import { getMyBuilds, deleteBuild } from '../api/builds'
import BuildCard from '../components/BuildCard'

interface ProfileFormValues {
  name: string
}

const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileFormValues>({
    defaultValues: { name: user?.name || '' },
  })

  const { data: buildsData, isLoading: buildsLoading } = useQuery({
    queryKey: ['my-builds'],
    queryFn: getMyBuilds,
  })
  const builds = buildsData?.items

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Выберите файл изображения')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой (максимум 5 МБ)')
      return
    }

    const preview = URL.createObjectURL(file)
    setAvatarPreview(preview)
    setUploadingAvatar(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)
      await updateProfile(formData)
      await refreshUser()
      toast.success('Аватар обновлён')
    } catch {
      toast.error('Ошибка загрузки аватара')
      setAvatarPreview(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleProfileUpdate = async (data: ProfileFormValues) => {
    try {
      const formData = new FormData()
      formData.append('name', data.name)
      await updateProfile(formData)
      await refreshUser()
      toast.success('Профиль обновлён')
    } catch {
      toast.error('Ошибка обновления профиля')
    }
  }

  const handleDeleteBuild = async (id: string, title: string) => {
    if (!confirm(`Удалить сборку «${title}»? Это действие нельзя отменить.`)) return
    setDeletingId(id)
    try {
      await deleteBuild(id)
      await queryClient.invalidateQueries({ queryKey: ['my-builds'] })
      toast.success('Сборка удалена')
    } catch {
      toast.error('Ошибка при удалении сборки')
    } finally {
      setDeletingId(null)
    }
  }

  if (!user) return null

  const currentAvatar = avatarPreview || user.avatar_url

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Профиль</h1>

      {/* Profile Card */}
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-24 h-24 rounded-full overflow-hidden bg-[#2A2A2A] cursor-pointer group relative"
              onClick={() => fileInputRef.current?.click()}
            >
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-[#FF6B00]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={24} className="text-white" />
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#FF6B00] rounded-full flex items-center justify-center hover:bg-[#E05A00] transition-colors"
              title="Изменить аватар"
            >
              <Camera size={13} className="text-white" />
            </button>
          </div>

          {/* Info + Edit form */}
          <div className="flex-1 w-full">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-white font-semibold text-lg">{user.name}</h2>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  user.role === 'superadmin'
                    ? 'bg-purple-900/40 text-purple-300 border border-purple-700'
                    : user.role === 'admin'
                    ? 'bg-blue-900/40 text-blue-300 border border-blue-700'
                    : user.role === 'master'
                    ? 'bg-orange-900/40 text-orange-300 border border-orange-700'
                    : 'bg-[#2A2A2A] text-[#AAAAAA]'
                }`}
              >
                {user.role === 'superadmin'
                  ? 'Суперадмин'
                  : user.role === 'admin'
                  ? 'Администратор'
                  : user.role === 'master'
                  ? 'Мастер'
                  : 'Пользователь'}
              </span>
            </div>
            {user.email && <p className="text-[#AAAAAA] text-sm mb-1">{user.email}</p>}
            {user.workshop_name && (
              <p className="text-[#AAAAAA] text-sm">Мастерская: {user.workshop_name}</p>
            )}

            {/* Edit form */}
            <form onSubmit={handleSubmit(handleProfileUpdate)} className="mt-4 flex gap-3 max-w-sm">
              <div className="flex-1">
                <input
                  {...register('name', {
                    required: 'Введите имя',
                    minLength: { value: 2, message: 'Минимум 2 символа' },
                  })}
                  className="input-field"
                  placeholder="Ваше имя"
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white px-3 py-2 rounded transition-colors text-sm disabled:opacity-50 shrink-0"
              >
                <Edit2 size={14} />
                Сохранить
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* My Builds */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Мои сборки</h2>
          <Link
            to="/builds/create"
            className="flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E05A00] text-white font-medium px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={15} />
            Создать сборку
          </Link>
        </div>

        {buildsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4 animate-pulse h-40"
              />
            ))}
          </div>
        ) : builds && builds.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {builds.map((build) => (
              <div key={build.id} className="relative group">
                <BuildCard build={build} />
                {/* Edit/Delete overlay */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    to={`/builds/${build.id}/edit`}
                    className="w-7 h-7 bg-[#2A2A2A] hover:bg-[#3A3A3A] rounded flex items-center justify-center text-[#AAAAAA] hover:text-white transition-colors"
                    title="Редактировать"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Edit2 size={13} />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      handleDeleteBuild(build.id, build.title)
                    }}
                    disabled={deletingId === build.id}
                    className="w-7 h-7 bg-red-900/80 hover:bg-red-800 rounded flex items-center justify-center text-red-300 hover:text-white transition-colors disabled:opacity-50"
                    title="Удалить"
                  >
                    {deletingId === build.id ? (
                      <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-8 text-center">
            <p className="text-[#AAAAAA] mb-4">У вас пока нет сборок</p>
            <Link
              to="/builds/create"
              className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E05A00] text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <Plus size={18} />
              Создать первую сборку
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfilePage
