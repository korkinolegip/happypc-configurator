import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Camera, Plus, Trash2, Edit2, Save, Lock,
  MapPin, Phone, Mail, User as UserIcon, Send, ExternalLink,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { updateProfile, changePassword } from '../api/auth'
import { getMyBuilds, deleteBuild, getMyDeletedBuilds, restoreBuild, permanentDeleteBuild } from '../api/builds'
const formatPrice = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
import CitySelect from '../components/CitySelect'

interface ProfileFormValues {
  name: string
  email: string
  phone: string
  city: string
  gender: string
}

interface PasswordFormValues {
  old_password: string
  new_password: string
  confirm_password: string
}

const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [buildsTab, setBuildsTab] = useState<'builds' | 'trash'>('builds')
  const [restoringTrashId, setRestoringTrashId] = useState<string | null>(null)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [availableAvatars, setAvailableAvatars] = useState<{ male: string[]; female: string[] } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    watch,
    setValue,
  } = useForm<ProfileFormValues>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      city: user?.city || '',
      gender: user?.gender || '',
    },
  })

  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
    reset: resetPwd,
  } = useForm<PasswordFormValues>()

  const { data: buildsData, isLoading: buildsLoading } = useQuery({
    queryKey: ['my-builds'],
    queryFn: getMyBuilds,
  })
  const builds = buildsData?.items

  const { data: deletedBuilds } = useQuery<{ id: string; title: string; total_price: number; items_count: number; deleted_by_name: string; deleted_at: string }[]>({
    queryKey: ['my-deleted-builds'],
    queryFn: getMyDeletedBuilds,
    enabled: buildsTab === 'trash',
  })

  const handleRestoreBuild = async (item: { id: string; title: string }) => {
    setRestoringTrashId(item.id)
    try {
      await restoreBuild(item.id)
      await queryClient.invalidateQueries({ queryKey: ['my-deleted-builds'] })
      await queryClient.invalidateQueries({ queryKey: ['my-builds'] })
      toast.success(`Сборка «${item.title}» восстановлена`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка восстановления')
    } finally {
      setRestoringTrashId(null)
    }
  }

  const handlePermanentDeleteBuild = async (item: { id: string; title: string }) => {
    if (!confirm(`Удалить навсегда «${item.title}»?`)) return
    try {
      await permanentDeleteBuild(item.id)
      await queryClient.invalidateQueries({ queryKey: ['my-deleted-builds'] })
      toast.success('Удалено из корзины')
    } catch {
      toast.error('Ошибка')
    }
  }

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
      const payload: Record<string, string | null> = {}
      if (data.name !== user?.name) payload.name = data.name
      if (data.email !== (user?.email || '')) payload.email = data.email || null
      if (data.phone !== (user?.phone || '')) payload.phone = data.phone || null
      if (data.city !== (user?.city || '')) payload.city = data.city || null
      if (data.gender !== (user?.gender || '')) payload.gender = data.gender || null

      if (Object.keys(payload).length === 0) {
        toast('Нет изменений')
        return
      }

      await updateProfile(payload)
      await refreshUser()
      toast.success('Профиль обновлён')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка обновления профиля')
    }
  }

  const handlePasswordChange = async (data: PasswordFormValues) => {
    if (data.new_password !== data.confirm_password) {
      toast.error('Пароли не совпадают')
      return
    }
    try {
      await changePassword(data)
      toast.success('Пароль изменён')
      resetPwd()
      setShowPasswordForm(false)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка смены пароля')
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
  const hasSocialAuth = !!user.telegram_username || !!user.vk_url

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-th-text">Настройки профиля</h1>

      {/* Avatar + Info */}
      <div className="bg-th-surface border border-th-border rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          {/* Avatar — bigger */}
          <div className="shrink-0">
            <div className="relative">
              <div
                className="w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-th-surface-2 cursor-pointer group relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {currentAvatar ? (
                  <img src={currentAvatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-[#FF6B00]">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera size={28} className="text-white" />
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
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#FF6B00] rounded-full flex items-center justify-center hover:bg-[#E05A00] transition-colors"
                title="Загрузить фото"
              >
                <Camera size={14} className="text-white" />
              </button>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!availableAvatars) {
                  try {
                    const resp = await fetch('/api/public/avatars')
                    setAvailableAvatars(await resp.json())
                  } catch {}
                }
                setShowAvatarPicker(true)
              }}
              className="mt-2 text-xs text-[#FF6B00] hover:text-[#E05A00] transition-colors w-full text-center"
            >
              Выбрать аватар
            </button>
          </div>

          {/* Quick info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-th-text font-semibold text-lg">{user.name}</h2>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  user.role === 'superadmin'
                    ? 'bg-purple-900/40 text-purple-300 border border-purple-700'
                    : user.role === 'admin'
                    ? 'bg-blue-900/40 text-blue-300 border border-blue-700'
                    : user.role === 'master'
                    ? 'bg-orange-900/40 text-orange-300 border border-orange-700'
                    : 'bg-th-surface-2 text-th-text-2'
                }`}
              >
                {user.role === 'superadmin' ? 'Суперадмин' : user.role === 'admin' ? 'Администратор' : user.role === 'master' ? 'Мастер' : 'Пользователь'}
              </span>
            </div>
            {user.email && <p className="text-th-text-2 text-sm">{user.email}</p>}
            {user.workshop_name && <p className="text-th-text-2 text-sm">Мастерская: {user.workshop_name}</p>}
            {user.city && <p className="text-th-text-2 text-sm flex items-center gap-1"><MapPin size={12} /> {user.city}</p>}
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-th-surface border border-th-border rounded-lg p-4 sm:p-6">
        <h2 className="text-th-text font-semibold mb-4 flex items-center gap-2">
          <UserIcon size={18} />
          Личные данные
        </h2>
        <form onSubmit={handleSubmit(handleProfileUpdate)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Имя</label>
              <input
                {...register('name', {
                  required: 'Введите имя',
                  minLength: { value: 2, message: 'Минимум 2 символа' },
                })}
                className="input-field"
                placeholder="Ваше имя"
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5 flex items-center gap-1">
                <Mail size={12} /> Email
              </label>
              <input
                {...register('email')}
                type="email"
                className="input-field"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5 flex items-center gap-1">
                <Phone size={12} /> Телефон
              </label>
              <input
                {...register('phone')}
                type="tel"
                className="input-field"
                placeholder="+7 (999) 999 99 99"
                onChange={(e) => {
                  let digits = e.target.value.replace(/\D/g, '')
                  if (digits.startsWith('8')) digits = '7' + digits.slice(1)
                  if (!digits.startsWith('7')) digits = '7' + digits
                  digits = digits.slice(0, 11)
                  let formatted = '+7'
                  if (digits.length > 1) formatted += ` (${digits.slice(1, 4)}`
                  if (digits.length >= 4) formatted += ')'
                  if (digits.length > 4) formatted += ` ${digits.slice(4, 7)}`
                  if (digits.length > 7) formatted += ` ${digits.slice(7, 9)}`
                  if (digits.length > 9) formatted += ` ${digits.slice(9, 11)}`
                  setValue('phone', formatted, { shouldDirty: true })
                }}
              />
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5 flex items-center gap-1">
                <MapPin size={12} /> Город
              </label>
              <CitySelect
                value={watch('city') || ''}
                onChange={(v) => setValue('city', v, { shouldDirty: true })}
                placeholder="Выберите город"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm text-th-text-2 mb-2">Пол</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('gender')}
                  type="radio"
                  value="male"
                  className="sr-only peer"
                />
                <div className="w-8 h-8 rounded-lg border border-th-border peer-checked:border-[#FF6B00] peer-checked:bg-[#FF6B00]/10 flex items-center justify-center text-sm font-medium text-th-text-2 peer-checked:text-[#FF6B00] transition-all">
                  М
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('gender')}
                  type="radio"
                  value="female"
                  className="sr-only peer"
                />
                <div className="w-8 h-8 rounded-lg border border-th-border peer-checked:border-[#FF6B00] peer-checked:bg-[#FF6B00]/10 flex items-center justify-center text-sm font-medium text-th-text-2 peer-checked:text-[#FF6B00] transition-all">
                  Ж
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="flex items-center gap-2 btn-primary px-5"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Сохранить
            </button>
          </div>
        </form>
      </div>

      {/* Social Links (read-only) */}
      {hasSocialAuth && (
        <div className="bg-th-surface border border-th-border rounded-lg p-4 sm:p-6">
          <h2 className="text-th-text font-semibold mb-4 flex items-center gap-2">
            <ExternalLink size={18} />
            Привязанные аккаунты
          </h2>
          <div className="space-y-3">
            {user.telegram_username && (
              <div className="flex items-center gap-3 text-sm">
                <Send size={16} className="text-[#2AABEE]" />
                <span className="text-th-text-2">Telegram:</span>
                <a
                  href={`https://t.me/${user.telegram_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2AABEE] hover:underline"
                >
                  @{user.telegram_username}
                </a>
              </div>
            )}
            {user.vk_url && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-[#4C75A3] font-bold text-xs w-4 text-center">VK</span>
                <span className="text-th-text-2">ВКонтакте:</span>
                <a
                  href={user.vk_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4C75A3] hover:underline"
                >
                  {user.vk_url.replace('https://vk.com/', '')}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="bg-th-surface border border-th-border rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-th-text font-semibold flex items-center gap-2">
            <Lock size={18} />
            Пароль
          </h2>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-sm text-[#FF6B00] hover:text-[#E05A00] transition-colors"
            >
              Изменить пароль
            </button>
          )}
        </div>

        {showPasswordForm ? (
          <form onSubmit={handleSubmitPwd(handlePasswordChange)} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Текущий пароль</label>
              <input
                {...registerPwd('old_password', { required: 'Введите текущий пароль' })}
                type="password"
                className="input-field"
                placeholder="Текущий пароль"
              />
              {pwdErrors.old_password && (
                <p className="text-red-400 text-xs mt-1">{pwdErrors.old_password.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Новый пароль</label>
              <input
                {...registerPwd('new_password', {
                  required: 'Введите новый пароль',
                  minLength: { value: 6, message: 'Минимум 6 символов' },
                })}
                type="password"
                className="input-field"
                placeholder="Минимум 6 символов"
              />
              {pwdErrors.new_password && (
                <p className="text-red-400 text-xs mt-1">{pwdErrors.new_password.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Подтвердите пароль</label>
              <input
                {...registerPwd('confirm_password', { required: 'Подтвердите пароль' })}
                type="password"
                className="input-field"
                placeholder="Повторите новый пароль"
              />
              {pwdErrors.confirm_password && (
                <p className="text-red-400 text-xs mt-1">{pwdErrors.confirm_password.message}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false)
                  resetPwd()
                }}
                className="btn-secondary flex-1"
              >
                Отмена
              </button>
              <button type="submit" disabled={pwdSubmitting} className="btn-primary flex-1">
                {pwdSubmitting ? 'Сохранение...' : 'Изменить пароль'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-th-muted text-sm">Рекомендуем использовать надёжный пароль длиной не менее 8 символов</p>
        )}
      </div>

      {/* My Builds */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-th-text font-semibold text-lg">Мои сборки</h2>
            <div className="flex gap-1 bg-th-surface border border-th-border rounded-lg p-0.5">
              <button
                onClick={() => setBuildsTab('builds')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  buildsTab === 'builds' ? 'bg-[#FF6B00] text-white' : 'text-th-text-2 hover:text-th-text'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setBuildsTab('trash')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                  buildsTab === 'trash' ? 'bg-[#FF6B00] text-white' : 'text-th-text-2 hover:text-th-text'
                }`}
              >
                <Trash2 size={11} />
                Корзина
                {deletedBuilds && deletedBuilds.length > 0 && (
                  <span className={`text-[10px] px-1 py-0 rounded-full ${
                    buildsTab === 'trash' ? 'bg-white/20' : 'bg-red-500/20 text-red-400'
                  }`}>{deletedBuilds.length}</span>
                )}
              </button>
            </div>
          </div>
          {buildsTab === 'builds' && (
            <Link
              to="/builds/create"
              className="flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E05A00] text-white font-medium px-3 py-2 rounded-lg text-sm transition-colors shrink-0"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Создать сборку</span>
              <span className="sm:hidden">Создать</span>
            </Link>
          )}
        </div>

        {/* TRASH VIEW */}
        {buildsTab === 'trash' && (
          <>
            {!deletedBuilds || deletedBuilds.length === 0 ? (
              <div className="bg-th-surface border border-th-border rounded-lg p-8 text-center">
                <Trash2 size={32} className="mx-auto mb-2 opacity-30 text-th-text-2" />
                <p className="text-th-text-2 text-sm">Корзина пуста</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deletedBuilds.map((item) => (
                  <div key={item.id} className="bg-th-surface border border-th-border rounded-lg p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-th-text font-semibold text-sm truncate">{item.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[#FF6B00] font-bold text-sm whitespace-nowrap">{formatPrice(item.total_price)} ₽</span>
                          <span className="text-th-text-3 text-xs">{item.items_count} компонентов</span>
                        </div>
                        <span className="text-th-muted text-xs mt-0.5 block">
                          Удалено: {new Date(item.deleted_at).toLocaleDateString('ru-RU')} · {item.deleted_by_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 -mt-0.5">
                        <button
                          onClick={() => handleRestoreBuild(item)}
                          disabled={restoringTrashId === item.id}
                          className="p-2 text-green-400 hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                          title="Восстановить"
                        >
                          {restoringTrashId === item.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <RotateCcw size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => handlePermanentDeleteBuild(item)}
                          className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Удалить навсегда"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* BUILDS VIEW */}
        {buildsTab === 'builds' && buildsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-th-surface border border-th-border rounded-lg p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : buildsTab === 'builds' && builds && builds.length > 0 ? (
          <div className="space-y-3">
            {builds.map((build) => (
              <div key={build.id} className="bg-th-surface border border-th-border rounded-lg p-3 sm:p-4 hover:border-[#FF6B00]/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/b/${build.short_code}`} className="flex-1 min-w-0">
                    <h3 className="text-th-text font-semibold text-sm truncate">{build.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[#FF6B00] font-bold text-sm whitespace-nowrap">{formatPrice(build.total_price)} ₽</span>
                      <span className="text-th-text-3 text-xs">{build.items_count} компонентов</span>
                    </div>
                    <span className="text-th-muted text-xs mt-0.5 block">{new Date(build.created_at).toLocaleDateString('ru-RU')}</span>
                  </Link>
                  <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
                    <Link
                      to={`/builds/${build.id}/edit`}
                      className="p-2 text-th-text-2 hover:text-th-text hover:bg-th-surface-2 rounded transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 size={15} />
                    </Link>
                    <button
                      onClick={() => handleDeleteBuild(build.id, build.title)}
                      disabled={deletingId === build.id}
                      className="p-2 text-th-text-2 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      title="Удалить"
                    >
                      {deletingId === build.id ? (
                        <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : buildsTab === 'builds' ? (
          <div className="bg-th-surface border border-th-border rounded-lg p-8 text-center">
            <p className="text-th-text-2 mb-4">У вас пока нет сборок</p>
            <Link
              to="/builds/create"
              className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E05A00] text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <Plus size={18} />
              Создать первую сборку
            </Link>
          </div>
        ) : null}
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && availableAvatars && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAvatarPicker(false)}>
          <div className="bg-th-surface border border-th-border rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
              <h2 className="text-th-text font-semibold">Выберите аватар</h2>
              <button onClick={() => setShowAvatarPicker(false)} className="text-th-text-2 hover:text-th-text">
                <Plus size={18} className="rotate-45" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[70vh]">
              {/* Male */}
              {availableAvatars.male.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-th-text-2 text-xs font-medium uppercase tracking-wide mb-3">Мужские</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {availableAvatars.male.map((url) => (
                      <button
                        key={url}
                        onClick={async () => {
                          try {
                            await updateProfile({ avatar_url: url })
                            await refreshUser()
                            setShowAvatarPicker(false)
                            toast.success('Аватар обновлён')
                          } catch { toast.error('Ошибка') }
                        }}
                        className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                          user.avatar_url === url ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/30' : 'border-th-border hover:border-[#FF6B00]/50'
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Female */}
              {availableAvatars.female.length > 0 && (
                <div>
                  <h3 className="text-th-text-2 text-xs font-medium uppercase tracking-wide mb-3">Женские</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {availableAvatars.female.map((url) => (
                      <button
                        key={url}
                        onClick={async () => {
                          try {
                            await updateProfile({ avatar_url: url })
                            await refreshUser()
                            setShowAvatarPicker(false)
                            toast.success('Аватар обновлён')
                          } catch { toast.error('Ошибка') }
                        }}
                        className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                          user.avatar_url === url ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/30' : 'border-th-border hover:border-[#FF6B00]/50'
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage
