import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Save, Mail, Send, Loader2, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSettings, updateSettings } from '../../api/admin'
import { client } from '../../api/client'
import type { AppSettings } from '../../types'

interface SmtpFormValues {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password: string
  smtp_from_email: string
  smtp_from_name: string
}

const EmailPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getSettings,
  })

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty },
    reset,
  } = useForm<SmtpFormValues>({
    values: settings
      ? {
          smtp_host: settings.smtp_host || '',
          smtp_port: settings.smtp_port || '465',
          smtp_user: settings.smtp_user || '',
          smtp_password: settings.smtp_password || '',
          smtp_from_email: settings.smtp_from_email || '',
          smtp_from_name: settings.smtp_from_name || '',
        }
      : undefined,
  })

  const onSubmit = async (data: SmtpFormValues) => {
    try {
      const payload: Partial<AppSettings> = {
        smtp_host: data.smtp_host || undefined,
        smtp_port: data.smtp_port || undefined,
        smtp_user: data.smtp_user || undefined,
        smtp_password: data.smtp_password || undefined,
        smtp_from_email: data.smtp_from_email || undefined,
        smtp_from_name: data.smtp_from_name || undefined,
      }
      const updated = await updateSettings(payload)
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      reset({
        smtp_host: updated.smtp_host || '',
        smtp_port: updated.smtp_port || '465',
        smtp_user: updated.smtp_user || '',
        smtp_password: updated.smtp_password || '',
        smtp_from_email: updated.smtp_from_email || '',
        smtp_from_name: updated.smtp_from_name || '',
      })
      toast.success('SMTP настройки сохранены')
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail) return
    setSendingTest(true)
    try {
      await client.post('/api/admin/email/test', { to_email: testEmail })
      toast.success(`Тестовое письмо отправлено на ${testEmail}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Ошибка отправки')
    } finally {
      setSendingTest(false)
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-th-text">Почта</h1>
        <p className="text-th-text-2 text-sm mt-1">Настройки SMTP для отправки писем</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* SMTP Connection */}
        <div className="bg-th-surface border border-th-border rounded-lg p-5">
          <h2 className="text-th-text font-semibold mb-4 flex items-center gap-2">
            <Mail size={18} />
            Подключение SMTP
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-th-text-2 mb-1.5">SMTP Хост</label>
                <input {...register('smtp_host')} className="input-field" placeholder="smtp.yandex.ru" />
              </div>
              <div>
                <label className="block text-sm text-th-text-2 mb-1.5">Порт</label>
                <input {...register('smtp_port')} type="number" className="input-field" placeholder="465" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-th-text-2 mb-1.5">Логин (email)</label>
                <input {...register('smtp_user')} className="input-field" placeholder="info@example.ru" />
              </div>
              <div>
                <label className="block text-sm text-th-text-2 mb-1.5">Пароль приложения</label>
                <input {...register('smtp_password')} type="password" className="input-field" placeholder="••••••••" />
              </div>
            </div>
          </div>
        </div>

        {/* Sender */}
        <div className="bg-th-surface border border-th-border rounded-lg p-5">
          <h2 className="text-th-text font-semibold mb-4">Отправитель</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Email отправителя</label>
              <input {...register('smtp_from_email')} className="input-field" placeholder="info@example.ru" />
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Имя отправителя</label>
              <input {...register('smtp_from_name')} className="input-field" placeholder="HappyPC" />
            </div>
          </div>
          <p className="text-th-muted text-xs mt-3 flex items-center gap-1">
            <Info size={11} />
            Получатели увидят это имя и email в поле «От кого»
          </p>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting || !isDirty} className="flex items-center gap-2 btn-primary px-6">
            {isSubmitting ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
            ) : (
              <><Save size={16} /> Сохранить</>
            )}
          </button>
        </div>
      </form>

      {/* Test email */}
      <div className="bg-th-surface border border-th-border rounded-lg p-5">
        <h2 className="text-th-text font-semibold mb-4 flex items-center gap-2">
          <Send size={18} />
          Тестовое письмо
        </h2>
        <p className="text-th-text-3 text-xs mb-3">
          Отправьте тестовое письмо, чтобы убедиться что SMTP настроен корректно
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="input-field flex-1"
            placeholder="test@example.com"
          />
          <button
            type="button"
            disabled={sendingTest || !testEmail}
            onClick={handleTestEmail}
            className="btn-primary flex items-center gap-2 px-4 whitespace-nowrap"
          >
            {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Отправить
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmailPage
