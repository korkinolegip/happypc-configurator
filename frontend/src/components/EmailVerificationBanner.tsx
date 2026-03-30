import React, { useState, useEffect, useCallback } from 'react'
import { Mail, X, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { verifyEmail, resendVerification } from '../api/auth'

const COOLDOWN_SECONDS = 60

const EmailVerificationBanner: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleVerify = useCallback(async () => {
    const trimmed = code.trim()
    if (trimmed.length !== 6) {
      toast.error('Введите 6-значный код')
      return
    }
    setIsVerifying(true)
    try {
      await verifyEmail(trimmed)
      toast.success('Email подтверждён!')
      await refreshUser()
      setCode('')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const msg = error.response?.data?.detail || 'Неверный код'
      toast.error(msg)
    } finally {
      setIsVerifying(false)
    }
  }, [code, refreshUser])

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return
    setIsResending(true)
    try {
      await resendVerification()
      toast.success('Код отправлен повторно')
      setCooldown(COOLDOWN_SECONDS)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const msg = error.response?.data?.detail || 'Ошибка отправки'
      toast.error(msg)
    } finally {
      setIsResending(false)
    }
  }, [cooldown])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleVerify()
      }
    },
    [handleVerify]
  )

  // Don't render if not logged in, no email, already verified, or dismissed
  if (!user || !user.email || user.email_verified || dismissed) {
    return null
  }

  return (
    <div className="bg-amber-600/90 text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 pr-6 sm:pr-0">
          {/* Message */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Mail size={16} className="flex-shrink-0" />
            <span className="text-sm font-medium">
              Подтвердите email — код отправлен на {user.email}
            </span>
          </div>

          {/* Code input + buttons */}
          <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
              placeholder="000000"
              className="w-24 px-2.5 py-1 text-sm bg-white/20 border border-white/30 rounded text-white placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-white/50"
            />
            <button
              onClick={handleVerify}
              disabled={isVerifying || code.length !== 6}
              className="flex items-center gap-1 px-3 py-1 text-sm font-medium bg-white text-amber-700 rounded hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle size={14} />
              )}
              Подтвердить
            </button>
            <button
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="text-sm text-white/80 hover:text-white underline underline-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isResending ? (
                'Отправка...'
              ) : cooldown > 0 ? (
                `Повторно (${cooldown}с)`
              ) : (
                'Отправить повторно'
              )}
            </button>
          </div>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-2 sm:relative sm:right-auto sm:top-auto text-white/70 hover:text-white transition-colors flex-shrink-0"
            title="Скрыть"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmailVerificationBanner
