import React, { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Save, Info, Upload, Download, FileText, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSettings, updateSettings, uploadLogo } from '../../api/admin'
import { client } from '../../api/client'
import type { AppSettings } from '../../types'

interface SettingsFormValues {
  registration_enabled: boolean
  public_feed_enabled: boolean
  default_labor_percent: string
  company_name: string
  telegram_bot_name: string
  vk_client_id: string
  pdf_footer_text: string
  // Help block
  help_block_text: string
  help_block_url: string
  help_block_label: string
}

const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const headerLogoRef = useRef<HTMLInputElement>(null)
  const pdfLogoRef = useRef<HTMLInputElement>(null)
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getSettings,
  })

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty },
    reset,
  } = useForm<SettingsFormValues>({
    values: settings
      ? {
          registration_enabled: settings.registration_enabled === 'true',
          public_feed_enabled: settings.public_feed_enabled === 'true',
          default_labor_percent: settings.default_labor_percent || '7',
          company_name: settings.company_name || 'HappyPC',
          telegram_bot_name: settings.telegram_bot_name || '',
          vk_client_id: settings.vk_client_id || '',
          pdf_footer_text: settings.pdf_footer_text || '',
          help_block_text: settings.help_block_text || '',
          help_block_url: settings.help_block_url || '',
          help_block_label: settings.help_block_label || '',
        }
      : undefined,
  })

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      const payload: Partial<AppSettings> = {
        registration_enabled: data.registration_enabled ? 'true' : 'false',
        public_feed_enabled: data.public_feed_enabled ? 'true' : 'false',
        default_labor_percent: data.default_labor_percent,
        company_name: data.company_name,
        telegram_bot_name: data.telegram_bot_name || undefined,
        vk_client_id: data.vk_client_id || undefined,
        pdf_footer_text: data.pdf_footer_text,
        help_block_text: data.help_block_text,
        help_block_url: data.help_block_url,
        help_block_label: data.help_block_label,
      }
      const updated = await updateSettings(payload)
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['settings-public'] })
      reset({
        registration_enabled: updated.registration_enabled === 'true',
        public_feed_enabled: updated.public_feed_enabled === 'true',
        default_labor_percent: updated.default_labor_percent || '7',
        company_name: updated.company_name || 'HappyPC',
        telegram_bot_name: updated.telegram_bot_name || '',
        vk_client_id: updated.vk_client_id || '',
        pdf_footer_text: updated.pdf_footer_text || '',
        help_block_text: updated.help_block_text || '',
        help_block_url: updated.help_block_url || '',
        help_block_label: updated.help_block_label || '',
      })
      toast.success('Настройки сохранены')
    } catch {
      toast.error('Ошибка сохранения настроек')
    }
  }

  const handleLogoUpload = async (type: 'header' | 'pdf', file: File) => {
    const setter = type === 'header' ? setUploadingHeader : setUploadingPdf
    setter(true)
    try {
      const result = await uploadLogo(type, file)
      toast.success(`Логотип ${type === 'header' ? 'шапки' : 'PDF'} обновлён`)
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    } catch {
      toast.error('Ошибка загрузки логотипа')
    } finally {
      setter(false)
    }
  }

  const handleExport = async (type: 'users' | 'builds') => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/export/${type}-csv`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Экспорт ${type === 'users' ? 'пользователей' : 'сборок'} завершён`)
    } catch {
      toast.error('Ошибка экспорта')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-th-surface-2 rounded animate-pulse w-40" />
        <div className="h-48 bg-th-surface border border-th-border rounded-lg animate-pulse" />
      </div>
    )
  }

  const headerLogoUrl = (settings as AppSettings)?.header_logo_url
  const pdfLogoUrl = (settings as AppSettings)?.pdf_logo_url

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-th-text">Настройки</h1>
        <p className="text-th-text-2 text-sm mt-1">Глобальные настройки платформы</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* General */}
        <div className="bg-th-surface border border-th-border rounded-lg p-5">
          <h2 className="text-th-text font-semibold mb-4">Основные</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Название компании</label>
              <input {...register('company_name')} className="input-field" placeholder="HappyPC" />
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Процент работы по умолчанию (%)</label>
              <input
                {...register('default_labor_percent', { min: { value: 0, message: 'Минимум 0' }, max: { value: 100, message: 'Максимум 100' } })}
                type="number" min="0" max="100" step="0.5" className="input-field max-w-xs" placeholder="7"
              />
              <p className="text-th-muted text-xs mt-1 flex items-center gap-1">
                <Info size={11} /> Используется при создании новых сборок
              </p>
            </div>
          </div>
        </div>

        {/* Access */}
        <div className="bg-th-surface border border-th-border rounded-lg p-5">
          <h2 className="text-th-text font-semibold mb-4">Доступ</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="relative mt-0.5">
                <input type="checkbox" {...register('registration_enabled')} className="sr-only peer" />
                <div className="w-11 h-6 bg-th-surface-2 peer-checked:bg-[#FF6B00] rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow" />
              </div>
              <div>
                <div className="text-th-text text-sm font-medium">Регистрация открыта</div>
                <div className="text-th-text-2 text-xs mt-0.5">Позволяет новым пользователям регистрироваться</div>
              </div>
            </label>
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="relative mt-0.5">
                <input type="checkbox" {...register('public_feed_enabled')} className="sr-only peer" />
                <div className="w-11 h-6 bg-th-surface-2 peer-checked:bg-[#FF6B00] rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow" />
              </div>
              <div>
                <div className="text-th-text text-sm font-medium">Публичная лента включена</div>
                <div className="text-th-text-2 text-xs mt-0.5">Показывает публичные сборки без авторизации</div>
              </div>
            </label>
          </div>
        </div>

        {/* Logos */}
        <div className="bg-th-surface border border-th-border rounded-lg p-5">
          <h2 className="text-th-text font-semibold mb-4 flex items-center gap-2">
            <Image size={18} />
            Логотипы
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Header logo */}
            <div>
              <label className="block text-sm text-th-text-2 mb-2">Логотип шапки</label>
              <div
                className="border border-dashed border-th-border rounded-lg p-4 text-center cursor-pointer hover:border-[#FF6B00] transition-colors"
                onClick={() => headerLogoRef.current?.click()}
              >
                {headerLogoUrl ? (
                  <img src={headerLogoUrl} alt="Header logo" className="h-10 mx-auto mb-2 object-contain" />
                ) : (
                  <Upload size={24} className="mx-auto text-th-muted mb-2" />
                )}
                <p className="text-th-text-2 text-xs">
                  {uploadingHeader ? 'Загрузка...' : 'Нажмите для загрузки'}
                </p>
              </div>
              <input
                ref={headerLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoUpload('header', file)
                }}
              />
            </div>
            {/* PDF logo */}
            <div>
              <label className="block text-sm text-th-text-2 mb-2">Логотип PDF</label>
              <div
                className="border border-dashed border-th-border rounded-lg p-4 text-center cursor-pointer hover:border-[#FF6B00] transition-colors"
                onClick={() => pdfLogoRef.current?.click()}
              >
                {pdfLogoUrl ? (
                  <img src={pdfLogoUrl} alt="PDF logo" className="h-10 mx-auto mb-2 object-contain" />
                ) : (
                  <Upload size={24} className="mx-auto text-th-muted mb-2" />
                )}
                <p className="text-th-text-2 text-xs">
                  {uploadingPdf ? 'Загрузка...' : 'Нажмите для загрузки'}
                </p>
              </div>
              <input
                ref={pdfLogoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoUpload('pdf', file)
                }}
              />
            </div>
          </div>
        </div>

        {/* PDF settings */}
        <div className="bg-th-surface border border-th-border rounded-lg p-5">
          <h2 className="text-th-text font-semibold mb-4 flex items-center gap-2">
            <FileText size={18} />
            Настройки PDF
          </h2>
          <div>
            <label className="block text-sm text-th-text-2 mb-1.5">Текст подвала PDF</label>
            <textarea
              {...register('pdf_footer_text')}
              className="input-field min-h-[80px] resize-y"
              placeholder="Контактная информация, реквизиты..."
              rows={3}
            />
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-th-surface border border-th-border rounded-lg p-5">
          <h2 className="text-th-text font-semibold mb-1">Интеграции</h2>
          <p className="text-th-text-2 text-xs mb-4">Настройка входа через социальные сети</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Telegram Bot Name</label>
              <input {...register('telegram_bot_name')} className="input-field" placeholder="my_happypc_bot" />
              <p className="text-th-muted text-xs mt-1">Имя бота без @. Для виджета входа через Telegram.</p>
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">VK App ID (Client ID)</label>
              <input {...register('vk_client_id')} className="input-field" placeholder="12345678" />
              <p className="text-th-muted text-xs mt-1">ID приложения ВКонтакте для OAuth.</p>
            </div>
          </div>
        </div>

        {/* Help block */}
        <div className="bg-th-surface border border-th-border rounded-lg p-5">
          <h2 className="text-th-text font-semibold mb-1 flex items-center gap-2">
            <Info size={18} />
            Блок помощи (главная)
          </h2>
          <p className="text-th-text-3 text-xs mb-4">Дополнительный информационный блок в сайдбаре</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Текст блока</label>
              <textarea {...register('help_block_text')} className="input-field resize-none h-16 text-sm"
                placeholder="Затрудняетесь с выбором комплектующих?" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-th-text-2 mb-1.5">Ссылка кнопки</label>
                <input {...register('help_block_url')} className="input-field" placeholder="/contact" />
              </div>
              <div>
                <label className="block text-sm text-th-text-2 mb-1.5">Текст кнопки</label>
                <input {...register('help_block_label')} className="input-field" placeholder="Задать вопрос" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting || !isDirty} className="flex items-center gap-2 btn-primary px-6">
            {isSubmitting ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
            ) : (
              <><Save size={16} /> Сохранить настройки</>
            )}
          </button>
        </div>
      </form>

      {/* Export section */}
      <div className="bg-th-surface border border-th-border rounded-lg p-5">
        <h2 className="text-th-text font-semibold mb-4 flex items-center gap-2">
          <Download size={18} />
          Экспорт данных
        </h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => handleExport('users')} className="btn-secondary flex items-center gap-2">
            <Download size={14} />
            Пользователи (CSV)
          </button>
          <button onClick={() => handleExport('builds')} className="btn-secondary flex items-center gap-2">
            <Download size={14} />
            Сборки (CSV)
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
