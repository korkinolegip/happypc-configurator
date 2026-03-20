import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Edit2, Trash2, KeyRound, X, Shield, Copy,
  Search, UserCheck, UserX, Phone, MapPin,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getWorkshops,
} from '../../api/admin'
import type { CreateUserData, UpdateUserData } from '../../api/admin'
import type { User } from '../../types'
import CitySelect from '../../components/CitySelect'

const ROLES = [
  { value: 'user', label: 'Пользователь' },
  { value: 'master', label: 'Мастер' },
  { value: 'admin', label: 'Администратор' },
  { value: 'superadmin', label: 'Суперадмин' },
]

const roleBadge = (role: string) => {
  switch (role) {
    case 'superadmin': return 'bg-purple-900/40 text-purple-300 border-purple-700'
    case 'admin': return 'bg-blue-900/40 text-blue-300 border-blue-700'
    case 'master': return 'bg-orange-900/40 text-orange-300 border-orange-700'
    default: return 'bg-th-surface-2 text-th-text-2 border-th-border-2'
  }
}

const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role

interface CreateModalProps {
  onClose: () => void
  workshops: { id: string; name: string }[]
}

const CreateUserModal: React.FC<CreateModalProps> = ({ onClose, workshops }) => {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = useForm<CreateUserData>()

  const onSubmit = async (data: CreateUserData) => {
    try {
      await createUser({ ...data, workshop_id: data.workshop_id || undefined })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Пользователь создан')
      onClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка создания пользователя')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-th-surface border border-th-border rounded-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
          <h2 className="text-th-text font-semibold">Создать пользователя</h2>
          <button onClick={onClose} className="text-th-text-2 hover:text-th-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Имя *</label>
              <input {...register('name', { required: 'Введите имя' })} className="input-field" placeholder="Имя" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Email *</label>
              <input
                {...register('email', { required: 'Введите email', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Некорректный email' } })}
                type="email" className="input-field" placeholder="email@example.com"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">Пароль *</label>
            <input
              {...register('password', { required: 'Введите пароль', minLength: { value: 6, message: 'Минимум 6 символов' } })}
              type="password" className="input-field" placeholder="Минимум 6 символов"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Телефон</label>
              <input {...register('phone')} className="input-field" placeholder="+7 (999) 123-45-67" />
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Город</label>
              <CitySelect
                value={watch('city') || ''}
                onChange={(v) => setValue('city', v, { shouldDirty: true })}
                placeholder="Выберите город"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Пол</label>
              <select {...register('gender')} className="select-field">
                <option value="">Не указан</option>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Роль</label>
              <select {...register('role')} className="select-field" defaultValue="user">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {workshops.length > 0 && (
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Мастерская</label>
              <select {...register('workshop_id')} className="select-field">
                <option value="">Без мастерской</option>
                {workshops.map((ws) => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditModalProps {
  user: User
  onClose: () => void
  workshops: { id: string; name: string }[]
}

const EditUserModal: React.FC<EditModalProps> = ({ user, onClose, workshops }) => {
  const queryClient = useQueryClient()
  const [showAvatars, setShowAvatars] = useState(false)
  const [avatars, setAvatars] = useState<{ male: string[]; female: string[] } | null>(null)
  const [currentAvatar, setCurrentAvatar] = useState(user.avatar_url)

  const loadAvatars = async () => {
    if (!avatars) {
      try {
        const resp = await fetch('/api/public/avatars')
        setAvatars(await resp.json())
      } catch {}
    }
    setShowAvatars(true)
  }

  const selectAvatar = async (url: string) => {
    try {
      await updateUser(user.id, { avatar_url: url } as UpdateUserData)
      setCurrentAvatar(url)
      setShowAvatars(false)
      toast.success('Аватар обновлён')
    } catch { toast.error('Ошибка') }
  }

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = useForm<UpdateUserData>({
    defaultValues: {
      name: user.name,
      email: user.email || '',
      role: user.role,
      workshop_id: user.workshop_id || '',
      city: user.city || '',
      phone: user.phone || '',
      gender: user.gender || '',
    },
  })

  const onSubmit = async (data: UpdateUserData) => {
    try {
      const payload = { ...data, workshop_id: data.workshop_id || null }
      await updateUser(user.id, payload)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Пользователь обновлён')
      onClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка обновления')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-th-surface border border-th-border rounded-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
          <h2 className="text-th-text font-semibold">Редактировать: {user.name}</h2>
          <button onClick={onClose} className="text-th-text-2 hover:text-th-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Имя</label>
              <input {...register('name', { required: 'Введите имя' })} className="input-field" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Email</label>
              <input {...register('email')} type="email" className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Телефон</label>
              <input {...register('phone')} className="input-field" placeholder="+7 (999) 123-45-67" />
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Город</label>
              <CitySelect
                value={watch('city') as string || ''}
                onChange={(v) => setValue('city', v, { shouldDirty: true })}
                placeholder="Выберите город"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Пол</label>
              <select {...register('gender')} className="select-field">
                <option value="">Не указан</option>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Роль</label>
              <select {...register('role')} className="select-field">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">Мастерская</label>
            <select {...register('workshop_id')} className="select-field">
              <option value="">Без мастерской</option>
              {workshops.map((ws) => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
            </select>
          </div>
          {/* Avatar */}
          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">Аватар</label>
            <div className="flex items-center gap-3">
              {currentAvatar ? (
                <img src={currentAvatar} alt="" className="w-12 h-12 rounded-full object-cover border border-th-border" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-sm font-bold text-[#FF6B00]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <button type="button" onClick={loadAvatars}
                className="text-xs text-[#FF6B00] hover:text-[#E05A00] transition-colors">
                Выбрать из галереи
              </button>
            </div>
            {showAvatars && avatars && (
              <div className="mt-3 bg-th-surface-2 border border-th-border rounded-lg p-3 max-h-40 overflow-y-auto">
                <div className="grid grid-cols-8 gap-1.5">
                  {[...avatars.male, ...avatars.female].map((url) => (
                    <button key={url} type="button" onClick={() => selectAvatar(url)}
                      className={`aspect-square rounded overflow-hidden border-2 transition-all hover:scale-105 ${currentAvatar === url ? 'border-[#FF6B00]' : 'border-transparent hover:border-[#FF6B00]/50'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">Новый пароль (оставьте пустым, чтобы не менять)</label>
            <input {...register('password')} type="password" className="input-field" placeholder="Новый пароль" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface PasswordModalProps {
  newPassword: string
  onClose: () => void
}

const NewPasswordModal: React.FC<PasswordModalProps> = ({ newPassword, onClose }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newPassword)
      toast.success('Пароль скопирован')
    } catch {
      toast.error('Не удалось скопировать')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-th-surface border border-th-border rounded-lg w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
          <h2 className="text-th-text font-semibold">Новый пароль</h2>
          <button onClick={onClose} className="text-th-text-2 hover:text-th-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <p className="text-th-text-2 text-sm mb-4">Пароль был сброшен. Сохраните его и передайте пользователю.</p>
          <div className="flex items-center gap-2 bg-th-surface-3 border border-th-border rounded-lg px-4 py-3">
            <code className="text-[#FF6B00] font-mono text-lg flex-1">{newPassword}</code>
            <button onClick={handleCopy} className="text-th-text-2 hover:text-th-text transition-colors" title="Скопировать">
              <Copy size={16} />
            </button>
          </div>
          <p className="text-yellow-500/80 text-xs mt-3">Этот пароль будет показан только один раз</p>
          <button onClick={onClose} className="btn-primary w-full mt-4">Понятно</button>
        </div>
      </div>
    </div>
  )
}

const UsersPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', searchQuery, roleFilter, activeFilter],
    queryFn: () => getUsers({
      search: searchQuery || undefined,
      role: roleFilter || undefined,
      is_active: activeFilter || undefined,
    }),
  })

  const { data: workshops } = useQuery({
    queryKey: ['admin-workshops'],
    queryFn: getWorkshops,
  })

  const handleDelete = async (user: User) => {
    if (!confirm(`Удалить пользователя «${user.name}»? Это действие нельзя отменить.`)) return
    setDeletingId(user.id)
    try {
      await deleteUser(user.id)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Пользователь удалён')
    } catch {
      toast.error('Ошибка при удалении')
    } finally {
      setDeletingId(null)
    }
  }

  const handleResetPassword = async (user: User) => {
    if (!confirm(`Сбросить пароль пользователя «${user.name}»?`)) return
    setResettingId(user.id)
    try {
      const result = await resetUserPassword(user.id)
      setNewPassword(result.new_password)
    } catch {
      toast.error('Ошибка при сбросе пароля')
    } finally {
      setResettingId(null)
    }
  }

  const handleToggleActive = async (user: User) => {
    const action = user.is_active !== false ? 'деактивировать' : 'активировать'
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} пользователя «${user.name}»?`)) return
    setTogglingId(user.id)
    try {
      await updateUser(user.id, { is_active: user.is_active === false })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(user.is_active === false ? 'Пользователь активирован' : 'Пользователь деактивирован')
    } catch {
      toast.error('Ошибка')
    } finally {
      setTogglingId(null)
    }
  }

  const workshopList = workshops ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-text">Пользователи</h1>
          <p className="text-th-text-2 text-sm mt-1">
            {users ? `${users.length} пользователей` : 'Загрузка...'}
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 btn-primary">
          <Plus size={16} />
          Создать
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
            placeholder="Поиск по имени, email, телефону, городу..."
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="select-field w-full sm:w-40">
          <option value="">Все роли</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}
          className="select-field w-full sm:w-36">
          <option value="">Все статусы</option>
          <option value="true">Активные</option>
          <option value="false">Деактивированные</option>
        </select>
      </div>

      <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-th-surface-2 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">Пользователь</th>
                  <th className="table-header text-left hidden sm:table-cell">Email</th>
                  <th className="table-header text-left hidden lg:table-cell">Телефон</th>
                  <th className="table-header text-left hidden lg:table-cell">Город</th>
                  <th className="table-header text-left">Роль</th>
                  <th className="table-header text-left hidden md:table-cell">Мастерская</th>
                  <th className="table-header text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-b border-th-border last:border-0 hover:bg-th-surface-2 transition-colors ${
                      user.is_active === false ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#FF6B00] flex items-center justify-center text-th-text text-xs font-bold shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-th-text text-sm font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="table-cell text-th-text-2 text-sm hidden sm:table-cell">{user.email || '—'}</td>
                    <td className="table-cell text-th-text-2 text-sm hidden lg:table-cell">{user.phone || '—'}</td>
                    <td className="table-cell text-th-text-2 text-sm hidden lg:table-cell">{user.city || '—'}</td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border font-medium ${roleBadge(user.role)}`}>
                        {(user.role === 'admin' || user.role === 'superadmin') && <Shield size={10} />}
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="table-cell text-th-text-2 text-sm hidden md:table-cell">{user.workshop_name || '—'}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={togglingId === user.id}
                          className="p-1.5 text-th-text-2 hover:text-green-400 hover:bg-green-900/20 rounded transition-colors"
                          title={user.is_active === false ? 'Активировать' : 'Деактивировать'}
                        >
                          {togglingId === user.id ? (
                            <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                          ) : user.is_active === false ? (
                            <UserX size={14} />
                          ) : (
                            <UserCheck size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          disabled={resettingId === user.id}
                          className="p-1.5 text-th-text-2 hover:text-yellow-400 hover:bg-yellow-900/20 rounded transition-colors"
                          title="Сбросить пароль"
                        >
                          {resettingId === user.id ? (
                            <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <KeyRound size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => setEditUser(user)}
                          className="p-1.5 text-th-text-2 hover:text-th-text hover:bg-th-surface-2 rounded transition-colors"
                          title="Редактировать"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={deletingId === user.id}
                          className="p-1.5 text-th-text-2 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Удалить"
                        >
                          {deletingId === user.id ? (
                            <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} workshops={workshopList} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} workshops={workshopList} />}
      {newPassword && <NewPasswordModal newPassword={newPassword} onClose={() => setNewPassword(null)} />}
    </div>
  )
}

export default UsersPage
