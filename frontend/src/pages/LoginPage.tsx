import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Cpu, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { login as apiLogin, register as apiRegister, getMe } from '../api/auth'
import { useQuery } from '@tanstack/react-query'
import { getPublicSettings } from '../api/builds'
import CitySelect from '../components/CitySelect'

const VK_CLIENT_ID = '54514351'
const TELEGRAM_BOT_NAME = 'happypcrubot'

interface LoginFormValues {
  email: string
  password: string
}

interface RegisterFormValues {
  email: string
  name: string
  phone: string
  gender: 'male' | 'female'
  city: string
  password: string
  password_confirm: string
}

const LoginPage: React.FC = () => {
  const { login: authLogin, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [oauthLoading, setOauthLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const { data: settings } = useQuery({
    queryKey: ['settings-public'],
    queryFn: getPublicSettings,
    retry: false,
  })

  // Helper to process OAuth token (used by both direct redirect and popup message)
  const processOAuthToken = (token: string, provider?: string, completeProfile?: boolean) => {
    setOauthLoading(true)
    localStorage.setItem('token', token)
    getMe()
      .then((user) => {
        authLogin(token, user)
        toast.success(provider ? `Вход через ${provider} выполнен!` : 'Добро пожаловать!')
        const target = completeProfile ? '/profile' : '/'
        if (completeProfile) {
          toast('Заполните профиль для полного доступа', { icon: 'ℹ️', duration: 5000 })
        }
        setTimeout(() => navigate(target, { replace: true }), 50)
      })
      .catch(() => {
        localStorage.removeItem('token')
        toast.error('Ошибка авторизации. Попробуйте ещё раз.')
        setOauthLoading(false)
      })
  }

  // OAuth callback handler — check URL for ?token=... from VK/Telegram redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return

    // If we're in a popup (Telegram auth), send token to opener and close
    if (window.opener && window.opener !== window) {
      window.opener.postMessage(
        {
          type: 'happypc_auth',
          token,
          provider: params.get('provider') || '',
          completeProfile: params.get('complete_profile') === '1',
        },
        window.location.origin,
      )
      window.close()
      return
    }

    // Normal flow (VK redirect or direct)
    window.history.replaceState({}, '', window.location.pathname)
    const completeProfile = params.get('complete_profile') === '1'
    processOAuthToken(token, params.get('provider') || undefined, completeProfile)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for postMessage from Telegram auth popup
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type !== 'happypc_auth' || !e.data?.token) return
      processOAuthToken(e.data.token, e.data.provider || undefined, e.data.completeProfile)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Если уже залогинен — редиректим сразу
  useEffect(() => {
    if (isAuthenticated && !oauthLoading) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  const loginForm = useForm<LoginFormValues>()
  const registerForm = useForm<RegisterFormValues>()

  const handleLogin = async (data: LoginFormValues) => {
    try {
      const response = await apiLogin(data)
      authLogin(response.access_token, response.user)
      toast.success('Добро пожаловать!')
      setTimeout(() => navigate(from, { replace: true }), 50)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const msg = error.response?.data?.detail || 'Неверный email или пароль'
      toast.error(msg)
    }
  }

  const handleRegister = async (data: RegisterFormValues) => {
    if (data.password !== data.password_confirm) {
      registerForm.setError('password_confirm', { message: 'Пароли не совпадают' })
      return
    }
    try {
      const response = await apiRegister({
        email: data.email,
        name: data.name,
        phone: data.phone,
        gender: data.gender,
        city: data.city || undefined,
        password: data.password,
      })
      authLogin(response.access_token, response.user)
      toast.success('Аккаунт создан!')
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const msg = error.response?.data?.detail || 'Ошибка регистрации'
      toast.error(msg)
    }
  }

  const registrationEnabled = settings?.registration_enabled === 'true'
  const vkClientId = settings?.vk_client_id || VK_CLIENT_ID
  const vkRedirectUri = `${window.location.origin}/api/auth/vk/callback`
  const vkAuthUrl = `https://id.vk.com/authorize?client_id=${vkClientId}&redirect_uri=${encodeURIComponent(vkRedirectUri)}&response_type=code&scope=vkid.personal_info+email&state=vk`

  const handleTelegramLogin = () => {
    const botName = settings?.telegram_bot_name || TELEGRAM_BOT_NAME
    const url = `/telegram-auth.html?bot=${encodeURIComponent(botName)}`
    const width = 500
    const height = 400
    const left = Math.round((screen.width - width) / 2)
    const top = Math.round((screen.height - height) / 2)
    const popup = window.open(
      url,
      'telegram_auth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    )
    if (!popup) {
      // Popup blocked — fallback to redirect
      window.location.href = url
    }
  }

  // Show loading spinner during OAuth callback processing
  if (oauthLoading) {
    return (
      <div className="min-h-screen bg-th-bg flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#FF6B00] animate-spin" />
          <span className="text-th-text-2 text-sm">Авторизация...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-th-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/static/logo-white.png"
            alt="HappyPC"
            className="h-12 mb-3"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const next = e.currentTarget.nextElementSibling as HTMLElement
              if (next) next.style.display = 'flex'
            }}
          />
          <div className="hidden items-center gap-2">
            <Cpu className="text-[#FF6B00]" size={28} />
            <span className="text-2xl font-bold">
              <span className="text-th-text">Happy</span>
              <span className="text-[#FF6B00]">PC</span>
            </span>
          </div>
          <p className="text-th-text-2 text-sm mt-2">Конфигуратор сборок ПК</p>
        </div>

        {/* Tabs */}
        {registrationEnabled && (
          <div className="flex bg-th-surface border border-th-border rounded-lg p-1 mb-5">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${
                mode === 'login'
                  ? 'bg-[#FF6B00] text-th-text'
                  : 'text-th-text-2 hover:text-th-text'
              }`}
            >
              Войти
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${
                mode === 'register'
                  ? 'bg-[#FF6B00] text-th-text'
                  : 'text-th-text-2 hover:text-th-text'
              }`}
            >
              Регистрация
            </button>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form
            onSubmit={loginForm.handleSubmit(handleLogin)}
            className="bg-th-surface border border-th-border rounded-lg p-6 space-y-4"
          >
            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Email</label>
              <input
                {...loginForm.register('email', {
                  required: 'Введите email',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Некорректный email' },
                })}
                type="email"
                className="input-field"
                placeholder="your@email.com"
                autoComplete="email"
              />
              {loginForm.formState.errors.email && (
                <p className="text-red-400 text-xs mt-1">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-th-text-2 mb-1.5">Пароль</label>
              <div className="relative">
                <input
                  {...loginForm.register('password', { required: 'Введите пароль' })}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-2 hover:text-th-text transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p className="text-red-400 text-xs mt-1">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginForm.formState.isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Вход...
                </span>
              ) : (
                'Войти'
              )}
            </button>
          </form>
        )}

        {/* Register Form */}
        {mode === 'register' && registrationEnabled && (
          <form
            onSubmit={registerForm.handleSubmit(handleRegister)}
            className="bg-th-surface border border-th-border rounded-lg p-6 space-y-3"
          >
            {/* Имя Фамилия */}
            <div>
              <label className="block text-sm text-th-text-2 mb-1">Имя и фамилия *</label>
              <input
                {...registerForm.register('name', {
                  required: 'Введите имя и фамилию',
                  minLength: { value: 2, message: 'Минимум 2 символа' },
                })}
                className="input-field"
                placeholder="Иван Иванов"
                autoComplete="name"
              />
              {registerForm.formState.errors.name && (
                <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.name.message}</p>
              )}
            </div>

            {/* Телефон + Пол */}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <label className="block text-sm text-th-text-2 mb-1">Телефон *</label>
                <input
                  {...registerForm.register('phone', {
                    required: 'Введите телефон',
                    pattern: {
                      value: /^[\d\s()+\-]{10,18}$/,
                      message: 'Формат: +7 (999) 999-99-99',
                    },
                  })}
                  type="tel"
                  className="input-field"
                  placeholder="+7 (999) 999-99-99"
                  autoComplete="tel"
                />
                {registerForm.formState.errors.phone && (
                  <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.phone.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-th-text-2 mb-1">Пол *</label>
                <div className="flex gap-1 h-[42px]">
                  <label className={`flex items-center px-3 rounded cursor-pointer border transition-colors text-sm ${
                    registerForm.watch('gender') === 'male'
                      ? 'border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]'
                      : 'border-th-border text-th-text-3 hover:border-th-muted'
                  }`}>
                    <input type="radio" value="male" {...registerForm.register('gender', { required: 'Выберите пол' })} className="hidden" />
                    М
                  </label>
                  <label className={`flex items-center px-3 rounded cursor-pointer border transition-colors text-sm ${
                    registerForm.watch('gender') === 'female'
                      ? 'border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]'
                      : 'border-th-border text-th-text-3 hover:border-th-muted'
                  }`}>
                    <input type="radio" value="female" {...registerForm.register('gender', { required: 'Выберите пол' })} className="hidden" />
                    Ж
                  </label>
                </div>
                {registerForm.formState.errors.gender && (
                  <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.gender.message}</p>
                )}
              </div>
            </div>

            {/* Email + Город */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-th-text-2 mb-1">Email *</label>
                <input
                  {...registerForm.register('email', {
                    required: 'Введите email',
                    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Некорректный email' },
                  })}
                  type="email"
                  className="input-field"
                  placeholder="your@email.com"
                  autoComplete="email"
                />
                {registerForm.formState.errors.email && (
                  <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-th-text-2 mb-1">Город</label>
                <CitySelect
                  value={registerForm.watch('city') || ''}
                  onChange={(v) => registerForm.setValue('city', v, { shouldDirty: true })}
                  placeholder="Выберите город"
                />
              </div>
            </div>

            {/* Пароль */}
            <div>
              <label className="block text-sm text-th-text-2 mb-1">Пароль *</label>
              <div className="relative">
                <input
                  {...registerForm.register('password', {
                    required: 'Введите пароль',
                    minLength: { value: 6, message: 'Минимум 6 символов' },
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-2 hover:text-th-text transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {registerForm.formState.errors.password && (
                <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.password.message}</p>
              )}
            </div>

            {/* Подтверждение пароля */}
            <div>
              <label className="block text-sm text-th-text-2 mb-1">Подтвердите пароль *</label>
              <input
                {...registerForm.register('password_confirm', { required: 'Подтвердите пароль' })}
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {registerForm.formState.errors.password_confirm && (
                <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.password_confirm.message}</p>
              )}
            </div>

            <button type="submit" disabled={registerForm.formState.isSubmitting}
              className="w-full bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {registerForm.formState.isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Регистрация...
                </span>
              ) : (
                'Создать аккаунт'
              )}
            </button>
          </form>
        )}

        {/* Social Login Divider */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-th-border" />
          <span className="text-th-text-3 text-xs uppercase tracking-wider">или</span>
          <div className="flex-1 h-px bg-th-border" />
        </div>

        {/* Social Login */}
        <div className="mt-4 flex gap-3">
          {/* Telegram */}
          <button
            onClick={handleTelegramLogin}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-lg transition-colors font-medium text-sm"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Telegram
          </button>

          {/* VK */}
          {vkClientId && (
            <a
              href={vkAuthUrl}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0077FF] hover:bg-[#0066DD] text-white rounded-lg transition-colors font-medium text-sm no-underline"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.677-1.253.677-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .643.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.745-.576.745z" />
              </svg>
              ВКонтакте
            </a>
          )}
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-th-text-2 hover:text-[#FF6B00] text-sm transition-colors">
            ← На главную
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
