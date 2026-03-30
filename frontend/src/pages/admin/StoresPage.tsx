import React, { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Edit2, Trash2, X, Store, Upload, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAdminStores,
  createStore,
  updateStore,
  deleteStore,
  uploadStoreIcon,
  fetchStoreIcon,
} from '../../api/admin'
import type { StoreData } from '../../api/admin'
import type { StoreInfo } from '../../types'

// ─── Modal ───────────────────────────────────────────────────────────────────

interface StoreFormValues {
  name: string
  short_label: string
  color: string
  url_patterns_text: string
}

interface StoreModalProps {
  store?: StoreInfo
  onClose: () => void
}

const StoreModal: React.FC<StoreModalProps> = ({ store, onClose }) => {
  const queryClient = useQueryClient()
  const isEdit = !!store
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(store?.icon_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [fetching, setFetching] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<StoreFormValues>({
    defaultValues: store
      ? {
          name: store.name,
          short_label: store.short_label,
          color: store.color,
          url_patterns_text: store.url_patterns.join('\n'),
        }
      : {
          name: '',
          short_label: '',
          color: '#FF6B00',
          url_patterns_text: '',
        },
  })

  const currentColor = watch('color')

  const onSubmit = async (data: StoreFormValues) => {
    const patterns = data.url_patterns_text.split('\n').map(p => p.trim()).filter(Boolean)
    const payload: StoreData = {
      name: data.name,
      short_label: data.short_label,
      color: data.color,
      url_patterns: patterns,
    }

    try {
      if (isEdit) {
        await updateStore(store!.slug, payload)
        toast.success('Магазин обновлён')
      } else {
        await createStore(payload)
        toast.success('Магазин создан')
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-stores'] })
      await queryClient.invalidateQueries({ queryKey: ['stores'] })
      onClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка операции')
    }
  }

  const handleUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !store) return
    setUploading(true)
    try {
      const updated = await uploadStoreIcon(store.slug, file)
      setIconPreview(updated.icon_url)
      await queryClient.invalidateQueries({ queryKey: ['admin-stores'] })
      await queryClient.invalidateQueries({ queryKey: ['stores'] })
      toast.success('Иконка загружена')
    } catch {
      toast.error('Ошибка загрузки иконки')
    } finally {
      setUploading(false)
    }
  }

  const handleFetchIcon = async () => {
    if (!store) return
    setFetching(true)
    try {
      const updated = await fetchStoreIcon(store.slug)
      setIconPreview(updated.icon_url)
      await queryClient.invalidateQueries({ queryKey: ['admin-stores'] })
      await queryClient.invalidateQueries({ queryKey: ['stores'] })
      toast.success('Иконка подтянута с сайта')
    } catch {
      toast.error('Не удалось подтянуть иконку')
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-th-surface border border-th-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
          <h2 className="text-th-text font-semibold">
            {isEdit ? 'Редактировать магазин' : 'Создать магазин'}
          </h2>
          <button
            onClick={onClose}
            className="text-th-text-2 hover:text-th-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">
              Название *
            </label>
            <input
              {...register('name', { required: 'Введите название' })}
              className="input-field"
              placeholder="Wildberries"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">
              Короткое название * <span className="text-th-muted">(макс. 6 символов)</span>
            </label>
            <input
              {...register('short_label', { required: 'Введите короткое название', maxLength: { value: 6, message: 'Максимум 6 символов' } })}
              className="input-field"
              placeholder="WB"
              maxLength={6}
            />
            {errors.short_label && (
              <p className="text-red-400 text-xs mt-1">{errors.short_label.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">
              Цвет
            </label>
            <div className="flex items-center gap-3">
              <input
                {...register('color')}
                type="color"
                className="w-10 h-10 rounded border border-th-border cursor-pointer bg-transparent"
              />
              <span className="text-th-text text-sm font-mono">{currentColor}</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: currentColor + '22',
                  color: currentColor,
                  border: `1px solid ${currentColor}44`,
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentColor }} />
                Preview
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">
              URL-паттерны <span className="text-th-muted">(один на строку)</span>
            </label>
            <textarea
              {...register('url_patterns_text')}
              className="input-field text-sm resize-none h-28 font-mono"
              placeholder={"wildberries.ru\nwb.ru"}
            />
          </div>

          {/* Icon management — only for editing existing stores */}
          {isEdit && (
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">
                Иконка
              </label>
              <div className="flex items-center gap-3">
                {iconPreview ? (
                  <img
                    src={iconPreview}
                    alt=""
                    className="w-10 h-10 rounded border border-th-border object-contain bg-th-surface-3"
                  />
                ) : (
                  <div className="w-10 h-10 rounded border border-th-border bg-th-surface-3 flex items-center justify-center">
                    <Store size={18} className="text-th-muted" />
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadIcon}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-th-surface-2 border border-th-border rounded text-th-text-2 hover:text-th-text hover:border-[#FF6B00] text-xs transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    Загрузить свою
                  </button>
                  <button
                    type="button"
                    onClick={handleFetchIcon}
                    disabled={fetching}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-th-surface-2 border border-th-border rounded text-th-text-2 hover:text-th-text hover:border-[#FF6B00] text-xs transition-colors disabled:opacity-50"
                  >
                    {fetching ? (
                      <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    Подтянуть с сайта
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1"
            >
              {isSubmitting
                ? isEdit
                  ? 'Сохранение...'
                  : 'Создание...'
                : isEdit
                ? 'Сохранить'
                : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const StoresPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalStore, setModalStore] = useState<StoreInfo | null | undefined>(undefined)
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)

  const { data: stores, isLoading } = useQuery({
    queryKey: ['admin-stores'],
    queryFn: getAdminStores,
  })

  const handleDelete = async (store: StoreInfo) => {
    if (!confirm(`Удалить магазин "${store.name}"?`)) return
    setDeletingSlug(store.slug)
    try {
      await deleteStore(store.slug)
      await queryClient.invalidateQueries({ queryKey: ['admin-stores'] })
      await queryClient.invalidateQueries({ queryKey: ['stores'] })
      toast.success('Магазин удалён')
    } catch {
      toast.error('Ошибка при удалении')
    } finally {
      setDeletingSlug(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-text">Магазины</h1>
          <p className="text-th-text-2 text-sm mt-1">
            {stores ? `${stores.length} магазинов` : 'Загрузка...'}
          </p>
        </div>
        <button
          onClick={() => setModalStore(null)}
          className="flex items-center gap-2 btn-primary"
        >
          <Plus size={16} />
          Создать
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-th-surface border border-th-border rounded-lg p-5 animate-pulse h-36"
            />
          ))}
        </div>
      ) : stores && stores.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((st) => (
            <div
              key={st.slug}
              className="bg-th-surface border border-th-border rounded-lg p-5 hover:border-[#FF6B00]/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {st.icon_url ? (
                    <img
                      src={st.icon_url}
                      alt=""
                      className="w-8 h-8 rounded object-contain shrink-0 bg-th-surface-3 border border-th-border"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: st.color + '22' }}
                    >
                      <Store size={16} style={{ color: st.color }} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-th-text font-semibold text-sm">{st.name}</h3>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide mt-0.5"
                      style={{
                        backgroundColor: st.color + '22',
                        color: st.color,
                        border: `1px solid ${st.color}44`,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: st.color }}
                      />
                      {st.short_label}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setModalStore(st)}
                    className="p-1.5 text-th-text-2 hover:text-th-text hover:bg-th-surface-2 rounded transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(st)}
                    disabled={deletingSlug === st.slug}
                    className="p-1.5 text-th-text-2 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    title="Удалить"
                  >
                    {deletingSlug === st.slug ? (
                      <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              </div>

              {/* Color swatch */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-4 h-4 rounded-sm border border-th-border shrink-0"
                  style={{ backgroundColor: st.color }}
                />
                <span className="text-th-muted text-xs font-mono">{st.color}</span>
              </div>

              {/* URL patterns */}
              <div className="pt-3 border-t border-th-border">
                <div className="flex flex-wrap gap-1">
                  {st.url_patterns.map((p, idx) => (
                    <span
                      key={idx}
                      className="inline-block bg-th-surface-2 text-th-text-2 text-[10px] px-1.5 py-0.5 rounded font-mono"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-th-surface border border-th-border rounded-lg p-10 text-center">
          <Store size={40} className="text-th-border mx-auto mb-4" />
          <p className="text-th-text-2 mb-4">Магазинов пока нет</p>
          <button
            onClick={() => setModalStore(null)}
            className="btn-primary"
          >
            <Plus size={16} className="inline mr-1.5" />
            Создать магазин
          </button>
        </div>
      )}

      {modalStore !== undefined && (
        <StoreModal
          store={modalStore ?? undefined}
          onClose={() => setModalStore(undefined)}
        />
      )}
    </div>
  )
}

export default StoresPage
