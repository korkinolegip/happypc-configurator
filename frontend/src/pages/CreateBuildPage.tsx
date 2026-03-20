import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import BuildForm from '../components/BuildForm'
import type { BuildFormValues } from '../components/BuildForm'
import { createBuild } from '../api/builds'

function flattenItems(data: BuildFormValues) {
  const all = [
    ...data.pc_items,
    ...data.extra_items,
    ...data.peri_items,
  ]
  return all
    .filter(item => item.name.trim())
    .map((item, index) => ({
      category: item.category,
      name: item.name.trim(),
      url: item.url.trim() || undefined,
      price: (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1),
      sort_order: index,
    }))
}

const CreateBuildPage: React.FC = () => {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: BuildFormValues) => {
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
        tags: data.tags ? [data.tags] : undefined,
        install_os: data.install_os || false,
        items: flattenItems(data),
      }
      const build = await createBuild(payload)
      toast.success('Сборка создана!')
      navigate(`/b/${build.short_code}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка при создании сборки')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-th-text">Создать сборку</h1>
        <p className="text-th-text-2 text-sm mt-1">
          Вставьте ссылки из DNS, Ozon, Wildberries — название и цена заполнятся автоматически
        </p>
      </div>
      <BuildForm onSubmit={handleSubmit} isSubmitting={isSubmitting} submitLabel="Создать сборку" />
    </div>
  )
}

export default CreateBuildPage
