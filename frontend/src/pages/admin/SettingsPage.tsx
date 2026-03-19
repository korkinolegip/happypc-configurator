import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Save, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSettings, updateSettings } from '../../api/admin'
import type { AppSettings } from '../../types'

interface SettingsFormValues {
  registration_enabled: boolean
  public_feed_enabled: boolean
  default_labor_percent: string
  company_name: string
  telegram_bot_name: string
  vk_client_id: string
}

const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient()

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
      })
      toast.success('Настройки сохранены')
    } catch {
      toast.error('Ошибка сохранения настроек')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-[#2A2A2A] rounded animate-pulse w-40" />
        <div className="h-48 bg-[#111111] border border-[#2A2A2A] rounded-lg animate-pulse" />
        <div className="h-48 bg-[#111111] border border-[#2A2A2A] rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Настройки</h1>
        <p className="text-[#AAAAAA] text-sm mt-1">Глобальные настройки платформы</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* General settings */}
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-5">
          <h2 className="text-white font-semibold mb-4">Основные</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#AAAAAA] mb-1.5">Название компании</label>
              <input
                {...register('company_name')}
                className="input-field"
                placeholder="HappyPC"
              />
            </div>
            <div>
              <label className="block text-sm text-[#AAAAAA] mb-1.5">
                Процент работы по умолчанию (%)
              </label>
              <input
                {...register('default_labor_percent', {
                  min: { value: 0, message: 'Минимум 0' },
                  max: { value: 100, message: 'Максимум 100' },
                })}
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="input-field max-w-xs"
                placeholder="7"
              />
              <p className="text-[#555555] text-xs mt-1 flex items-center gap-1">
                <Info size={11} />
                Используется при создании новых сборок
              </p>
            </div>
          </div>
        </div>

        {/* Access settings */}
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-5">
          <h2 className="text-white font-semibold mb-4">Доступ</h2>
          <div className="space-y-4">
            {/* Registration toggle */}
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  {...register('registration_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2A2A2A] peer-checked:bg-[#FF6B00] rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow" />
              </div>
              <div>
                <div className="text-white text-sm font-medium">Регистрация открыта</div>
                <div className="text-[#AAAAAA] text-xs mt-0.5">
                  Позволяет новым пользователям самостоятельно регистрироваться
                </div>
              </div>
            </label>

            {/* Feed toggle */}
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  {...register('public_feed_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2A2A2A] peer-checked:bg-[#FF6B00] rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow" />
              </div>
              <div>
                <div className="text-white text-sm font-medium">Публичная лента включена</div>
                <div className="text-[#AAAAAA] text-xs mt-0.5">
                  Показывает публичные сборки на главной странице без авторизации
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-5">
          <h2 className="text-white font-semibold mb-1">Интеграции</h2>
          <p className="text-[#AAAAAA] text-xs mb-4">Настройка входа через социальные сети</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#AAAAAA] mb-1.5">
                Telegram Bot Name
              </label>
              <input
                {...register('telegram_bot_name')}
                className="input-field"
                placeholder="my_happypc_bot"
              />
              <p className="text-[#555555] text-xs mt-1">
                Имя бота без символа @. Используется для виджета входа через Telegram.
              </p>
            </div>

            <div>
              <label className="block text-sm text-[#AAAAAA] mb-1.5">
                VK App ID (Client ID)
              </label>
              <input
                {...register('vk_client_id')}
                className="input-field"
                placeholder="12345678"
              />
              <p className="text-[#555555] text-xs mt-1">
                ID приложения ВКонтакте для OAuth авторизации.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="flex items-center gap-2 btn-primary px-6"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save size={16} />
                Сохранить настройки
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SettingsPage
