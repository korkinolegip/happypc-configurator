import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Edit2, Trash2, X, Building2, MapPin, Users, HardDrive } from 'lucide-react'
import toast from 'react-hot-toast'
import CitySelect from '../../components/CitySelect'
import {
  getWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
} from '../../api/admin'
import type { WorkshopData } from '../../api/admin'
import type { Workshop } from '../../types'

interface WorkshopModalProps {
  workshop?: Workshop
  onClose: () => void
}

const WorkshopModal: React.FC<WorkshopModalProps> = ({ workshop, onClose }) => {
  const queryClient = useQueryClient()
  const isEdit = !!workshop

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<WorkshopData>({
    defaultValues: workshop
      ? { name: workshop.name, city: workshop.city }
      : { name: '', city: '' },
  })

  const onSubmit = async (data: WorkshopData) => {
    try {
      if (isEdit) {
        await updateWorkshop(workshop!.id, data)
        toast.success('Мастерская обновлена')
      } else {
        await createWorkshop(data)
        toast.success('Мастерская создана')
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-workshops'] })
      onClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка операции')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2A]">
          <h2 className="text-white font-semibold">
            {isEdit ? 'Редактировать мастерскую' : 'Создать мастерскую'}
          </h2>
          <button
            onClick={onClose}
            className="text-[#AAAAAA] hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-[#AAAAAA] mb-1.5">
              Название *
            </label>
            <input
              {...register('name', { required: 'Введите название' })}
              className="input-field"
              placeholder="Название мастерской"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-[#AAAAAA] mb-1.5">
              Город *
            </label>
            <CitySelect
              value={watch('city') || ''}
              onChange={(v) => setValue('city', v, { shouldDirty: true, shouldValidate: true })}
              placeholder="Выберите город"
            />
            <input type="hidden" {...register('city', { required: 'Выберите город' })} />
            {errors.city && (
              <p className="text-red-400 text-xs mt-1">{errors.city.message}</p>
            )}
          </div>
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

const WorkshopsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalWorkshop, setModalWorkshop] = useState<Workshop | null | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: workshops, isLoading } = useQuery({
    queryKey: ['admin-workshops'],
    queryFn: getWorkshops,
  })

  const handleDelete = async (workshop: Workshop) => {
    if (
      !confirm(
        `Удалить мастерскую «${workshop.name}»? Это отвяжет всех мастеров от неё.`
      )
    )
      return
    setDeletingId(workshop.id)
    try {
      await deleteWorkshop(workshop.id)
      await queryClient.invalidateQueries({ queryKey: ['admin-workshops'] })
      toast.success('Мастерская удалена')
    } catch {
      toast.error('Ошибка при удалении')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Мастерские</h1>
          <p className="text-[#AAAAAA] text-sm mt-1">
            {workshops ? `${workshops.length} мастерских` : 'Загрузка...'}
          </p>
        </div>
        <button
          onClick={() => setModalWorkshop(null)}
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
              className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-5 animate-pulse h-36"
            />
          ))}
        </div>
      ) : workshops && workshops.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workshops.map((ws) => (
            <div
              key={ws.id}
              className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-5 hover:border-[#FF6B00]/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-[#FF6B00] shrink-0" />
                  <h3 className="text-white font-semibold text-sm">{ws.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setModalWorkshop(ws)}
                    className="p-1.5 text-[#AAAAAA] hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(ws)}
                    disabled={deletingId === ws.id}
                    className="p-1.5 text-[#AAAAAA] hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    title="Удалить"
                  >
                    {deletingId === ws.id ? (
                      <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin block" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[#AAAAAA] text-xs mb-3">
                <MapPin size={12} />
                <span>{ws.city}</span>
              </div>

              <div className="flex gap-4 pt-3 border-t border-[#2A2A2A]">
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-[#AAAAAA]" />
                  <span className="text-[#AAAAAA] text-xs">{ws.masters_count} мастеров</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive size={12} className="text-[#AAAAAA]" />
                  <span className="text-[#AAAAAA] text-xs">{ws.builds_count} сборок</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-10 text-center">
          <Building2 size={40} className="text-[#2A2A2A] mx-auto mb-4" />
          <p className="text-[#AAAAAA] mb-4">Мастерских пока нет</p>
          <button
            onClick={() => setModalWorkshop(null)}
            className="btn-primary"
          >
            <Plus size={16} className="inline mr-1.5" />
            Создать мастерскую
          </button>
        </div>
      )}

      {modalWorkshop !== undefined && (
        <WorkshopModal
          workshop={modalWorkshop ?? undefined}
          onClose={() => setModalWorkshop(undefined)}
        />
      )}
    </div>
  )
}

export default WorkshopsPage
