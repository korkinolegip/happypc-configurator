import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import BuildForm from '../components/BuildForm'
import type { BuildFormValues } from '../components/BuildForm'
import { getBuild, updateBuild } from '../api/builds'

function flattenItems(data: BuildFormValues) {
  const all = [
    ...data.pc_items,
    ...data.extra_items,
    ...data.peri_items,
  ]
  return all
    .filter(item => item.name.trim())
    .map((item, index) => ({
      id: item.id,
      category: item.category,
      name: item.name.trim(),
      url: item.url.trim() || undefined,
      price: (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1),
      sort_order: index,
    }))
}

const EditBuildPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: build, isLoading, error } = useQuery({
    queryKey: ['build', id],
    queryFn: () => getBuild(id!),
    enabled: !!id,
  })

  const handleSubmit = async (data: BuildFormValues) => {
    if (!id || !build) return
    if (!data.title.trim()) {
      toast.error('Введите название сборки')
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        title: data.title.trim(),
        description: data.description.trim() || undefined,
        is_public: !data.is_private,
        password: data.password || undefined,
        labor_percent: parseFloat(data.labor_percent) || 7,
        labor_price_manual:
          data.labor_price_manual && parseFloat(data.labor_price_manual) > 0
            ? parseFloat(data.labor_price_manual)
            : null,
        tags: data.tags ? [data.tags] : [],
        install_os: data.install_os || false,
        items: flattenItems(data),
      }
      const updated = await updateBuild(id, payload)
      toast.success('Сборка обновлена!')
      navigate(`/b/${updated.short_code}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка при сохранении сборки')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !build) return (
    <div className="text-center py-20">
      <p className="text-th-text-2">Сборка не найдена</p>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-th-text">Редактировать сборку</h1>
        <p className="text-th-text-2 text-sm mt-1">{build.title}</p>
      </div>
      <BuildForm initialData={build} onSubmit={handleSubmit} isSubmitting={isSubmitting} submitLabel="Сохранить изменения" />
    </div>
  )
}

export default EditBuildPage
