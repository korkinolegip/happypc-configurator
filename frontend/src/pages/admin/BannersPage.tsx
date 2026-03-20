import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Edit2, Trash2, X, Eye, EyeOff, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAdminBanners, createBanner, updateBanner, deleteBanner,
} from '../../api/admin'
import type { AdminBanner } from '../../api/admin'

interface BannerFormData {
  title: string
  text: string
  button_text: string
  button_url: string
  position: string
  is_active: boolean
}

interface ModalProps {
  banner?: AdminBanner
  onClose: () => void
}

const BannerModal: React.FC<ModalProps> = ({ banner, onClose }) => {
  const queryClient = useQueryClient()
  const isEdit = !!banner
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<BannerFormData>({
    defaultValues: banner
      ? { title: banner.title, text: banner.text || '', button_text: banner.button_text || '', button_url: banner.button_url || '', position: String(banner.position), is_active: banner.is_active }
      : { title: '', text: '', button_text: '', button_url: '', position: '0', is_active: true },
  })

  const onSubmit = async (data: BannerFormData) => {
    try {
      const payload = { ...data, position: parseInt(data.position) || 0 }
      if (isEdit) {
        await updateBanner(banner!.id, payload)
        toast.success('Баннер обновлён')
      } else {
        await createBanner(payload)
        toast.success('Баннер создан')
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-banners'] })
      onClose()
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-th-surface border border-th-border rounded-lg w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
          <h2 className="text-th-text font-semibold">{isEdit ? 'Редактировать баннер' : 'Создать баннер'}</h2>
          <button onClick={onClose} className="text-th-text-2 hover:text-th-text transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">Заголовок *</label>
            <input {...register('title', { required: 'Введите заголовок' })} className="input-field" placeholder="Подделки процессоров AMD" />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">Текст (описание)</label>
            <textarea {...register('text')} className="input-field resize-none h-20 text-sm" placeholder="Подробное описание..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Текст кнопки</label>
              <input {...register('button_text')} className="input-field" placeholder="Подробнее тут!" />
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Ссылка кнопки</label>
              <input {...register('button_url')} className="input-field" placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Позиция (порядок)</label>
              <input {...register('position')} type="number" className="input-field" placeholder="0" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="sr-only peer" />
                <div className="w-9 h-5 bg-th-surface-2 peer-checked:bg-[#FF6B00] rounded-full transition-colors relative">
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                </div>
                <span className="text-sm text-th-text">Активен</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const BannersPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalBanner, setModalBanner] = useState<AdminBanner | undefined | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: banners, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: getAdminBanners,
  })

  const handleDelete = async (banner: AdminBanner) => {
    if (!confirm(`Удалить баннер «${banner.title}»?`)) return
    setDeletingId(banner.id)
    try {
      await deleteBanner(banner.id)
      await queryClient.invalidateQueries({ queryKey: ['admin-banners'] })
      toast.success('Баннер удалён')
    } catch {
      toast.error('Ошибка удаления')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggle = async (banner: AdminBanner) => {
    try {
      await updateBanner(banner.id, { is_active: !banner.is_active })
      await queryClient.invalidateQueries({ queryKey: ['admin-banners'] })
      toast.success(banner.is_active ? 'Баннер скрыт' : 'Баннер активирован')
    } catch {
      toast.error('Ошибка')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-text">Баннеры</h1>
          <p className="text-th-text-2 text-sm mt-1">Информационные блоки на главной странице</p>
        </div>
        <button onClick={() => setModalBanner(undefined)} className="flex items-center gap-2 btn-primary">
          <Plus size={16} />
          Создать
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-th-surface border border-th-border rounded-lg p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : banners && banners.length > 0 ? (
        <div className="space-y-3">
          {banners.map(banner => (
            <div key={banner.id} className={`bg-th-surface border border-th-border rounded-lg p-4 ${!banner.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <GripVertical size={16} className="text-th-muted mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-th-text font-semibold text-sm">{banner.title}</h3>
                    {banner.text && <p className="text-th-text-2 text-xs mt-1 line-clamp-2">{banner.text}</p>}
                    {banner.button_text && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-[#FF6B00]/10 text-[#FF6B00] text-xs rounded">
                        {banner.button_text} → {banner.button_url}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-th-muted text-xs mr-2">#{banner.position}</span>
                  <button onClick={() => handleToggle(banner)}
                    className="p-1.5 text-th-text-2 hover:text-th-text rounded transition-colors"
                    title={banner.is_active ? 'Скрыть' : 'Показать'}>
                    {banner.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => setModalBanner(banner)}
                    className="p-1.5 text-th-text-2 hover:text-th-text hover:bg-th-surface-2 rounded transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(banner)}
                    disabled={deletingId === banner.id}
                    className="p-1.5 text-th-text-2 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors">
                    {deletingId === banner.id
                      ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-th-surface border border-th-border rounded-lg p-10 text-center">
          <p className="text-th-text-2 mb-4">Баннеров пока нет</p>
          <button onClick={() => setModalBanner(undefined)} className="btn-primary">
            <Plus size={16} className="inline mr-1.5" />
            Создать первый баннер
          </button>
        </div>
      )}

      {modalBanner !== null && (
        <BannerModal
          banner={modalBanner}
          onClose={() => setModalBanner(null)}
        />
      )}
    </div>
  )
}

export default BannersPage
