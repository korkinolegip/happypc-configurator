import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Download, Share2, Copy, Lock, ExternalLink, Edit, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getPublicBuild, downloadPDF, copyBuild } from '../api/builds'
import { useAuth } from '../hooks/useAuth'
import CategoryIcon from '../components/CategoryIcon'
import PriceBlock from '../components/PriceBlock'
import ShareModal from '../components/ShareModal'
import { STORE_INFO, detectStore, StoreBadge } from '../components/BuildForm'

function StoreIcon({ url }: { url: string | null }) {
  if (!url) return null
  const store = detectStore(url)
  if (!store) return null
  return <StoreBadge store={store} />
}

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

const formatPrice = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

interface PasswordForm { password: string }

// ─── Components table section ─────────────────────────────────────────────────
function ComponentsSection({ items }: { items: { id: string; category: string; name: string; url: string | null; price: number; sort_order: number }[] }) {
  const [open, setOpen] = useState(true)
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const total = items.reduce((s, i) => s + i.price, 0)
  return (
    <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-th-surface-2 transition-colors"
      >
        <span className="text-th-text font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full" />
          Персональный компьютер
        </span>
        <div className="flex items-center gap-3">
          <span className="text-th-text-2 text-sm">{items.length} позиций</span>
          {open ? <ChevronUp size={16} className="text-th-text-2" /> : <ChevronDown size={16} className="text-th-text-2" />}
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {sorted.map((item, idx) => (
                <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-th-surface-3' : 'bg-th-surface'} hover:bg-th-surface-2 transition-colors`}>
                  <td className="px-3 py-2.5 w-9">
                    <CategoryIcon category={item.category} size={28} />
                  </td>
                  <td className="px-2 py-2.5 w-36">
                    <span className="text-th-text-2 text-xs">{item.category}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                         className="text-th-text hover:text-[#FF6B00] transition-colors flex items-center gap-1.5 group text-sm">
                        <StoreIcon url={item.url} />
                        {item.name}
                        <ExternalLink size={11} className="text-th-muted group-hover:text-[#FF6B00] shrink-0" />
                      </a>
                    ) : (
                      <span className="text-th-text text-sm">{item.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="text-th-text text-sm font-medium">{formatPrice(item.price)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="px-4 py-2.5 border-t border-th-border flex justify-end">
          <span className="text-th-text-2 text-sm">ИТОГО: <span className="text-th-text font-semibold">{formatPrice(total)}</span></span>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
const BuildPage: React.FC = () => {
  const { short_code } = useParams<{ short_code: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [password, setPassword] = useState<string | undefined>(undefined)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [copyingBuild, setCopyingBuild] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<PasswordForm>()

  const { data: build, isLoading, error, refetch } = useQuery({
    queryKey: ['public-build', short_code, password],
    queryFn: () => getPublicBuild(short_code!, password),
    enabled: !!short_code,
    retry: false,
  })

  const handlePasswordSubmit = (data: PasswordForm) => {
    setPassword(data.password)
    refetch()
  }

  const handleDownloadPDF = async () => {
    if (!short_code) return
    setPdfLoading(true)
    try {
      await downloadPDF(short_code)
      toast.success('PDF скачан')
    } catch {
      toast.error('Ошибка при скачивании PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleCopyBuild = async () => {
    if (!build) return
    setCopyingBuild(true)
    try {
      const newBuild = await copyBuild(build.id)
      toast.success('Сборка скопирована!')
      navigate(`/builds/${newBuild.id}/edit`)
    } catch {
      toast.error('Ошибка при копировании сборки')
    } finally {
      setCopyingBuild(false)
    }
  }

  const isOwner = user?.id === build?.author?.id

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (status === 401 || status === 403 || (!password && status === 422)) {
      return (
        <div className="max-w-sm mx-auto mt-16">
          <div className="bg-th-surface border border-th-border rounded-lg p-6 text-center">
            <Lock size={40} className="text-[#FF6B00] mx-auto mb-4" />
            <h2 className="text-th-text font-semibold text-lg mb-2">Доступ закрыт</h2>
            <p className="text-th-text-2 text-sm mb-5">Сборка защищена паролем.</p>
            <form onSubmit={handleSubmit(handlePasswordSubmit)} className="space-y-3">
              <input {...register('password', { required: 'Введите пароль' })} type="password"
                className="input-field text-center" placeholder="Введите пароль" autoFocus />
              {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
              <button type="submit"
                className="w-full bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold py-2.5 rounded-lg transition-colors">
                Открыть
              </button>
            </form>
            <Link to="/" className="inline-block mt-4 text-th-text-2 hover:text-th-text text-sm transition-colors">← На главную</Link>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-th-text-2 text-lg mb-4">Сборка не найдена</p>
        <Link to="/" className="text-[#FF6B00] hover:underline text-sm">← На главную</Link>
      </div>
    )
  }

  if (!build) return null

  const buildUrl = window.location.href

  return (
    <div className="max-w-6xl mx-auto">
      {showShare && <ShareModal url={buildUrl} onClose={() => setShowShare(false)} />}

      {/* Breadcrumb */}
      <div className="text-xs text-th-muted mb-3 flex items-center gap-1.5">
        <Link to="/" className="hover:text-th-text-2 transition-colors">Главная</Link>
        <span>›</span>
        <Link to="/" className="hover:text-th-text-2 transition-colors">Сборки</Link>
        <span>›</span>
        <span className="text-th-text-2">Сборка: {build.short_code}</span>
      </div>

      {/* Title + updated */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-th-text">{build.title}</h1>
          <p className="text-th-muted text-xs mt-1">Обновлено: {formatDate(build.updated_at)}</p>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {isOwner && (
            <Link to={`/builds/${build.id}/edit`}
              className="flex items-center gap-1.5 bg-th-surface-2 hover:bg-th-border text-th-text px-3 py-2 rounded-lg text-sm transition-colors">
              <Edit size={14} />Редактировать
            </Link>
          )}
          {isAuthenticated && !isOwner && (
            <button onClick={handleCopyBuild} disabled={copyingBuild}
              className="flex items-center gap-1.5 bg-th-surface-2 hover:bg-th-border text-th-text px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
              {copyingBuild ? <span className="w-3.5 h-3.5 border-2 border-th-text border-t-transparent rounded-full animate-spin" /> : <Copy size={14} />}
              Собрать свой ПК
            </button>
          )}
          <button onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 bg-th-surface-2 hover:bg-th-border text-th-text px-3 py-2 rounded-lg text-sm transition-colors">
            <Share2 size={14} />Поделиться
          </button>
          <button onClick={handleDownloadPDF} disabled={pdfLoading}
            className="flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E05A00] text-white px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
            {pdfLoading ? <span className="w-3.5 h-3.5 border-2 border-th-text border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
            Скачать PDF
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5 items-start">

        {/* LEFT: components + price + comments */}
        <div>
          {/* Description */}
          {build.description && (
            <div className="bg-th-surface border border-th-border rounded-lg p-4 mb-4">
              <p className="text-th-text-2 text-sm leading-relaxed">{build.description}</p>
            </div>
          )}

          {/* Components */}
          <ComponentsSection items={build.items} />

          {/* Price block */}
          <PriceBlock
            hardwareTotal={build.hardware_total ?? build.total_price}
            totalPrice={build.total_price}
            laborCost={build.labor_cost ?? 0}
            laborPercent={build.labor_percent}
            laborPriceManual={build.labor_price_manual}
          />

          {/* Grand total big */}
          <div className="text-right my-4">
            <p className="text-th-text-2 text-sm">ИТОГО СБОРКИ:</p>
            <p className="text-[#FF6B00] font-bold text-3xl">{formatPrice(build.total_price)}</p>
          </div>

          {/* Action buttons row */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Link to="/"
              className="flex-1 text-center py-2.5 px-4 bg-th-surface-2 border border-th-border hover:border-[#FF6B00] text-th-text-2 hover:text-th-text rounded-lg text-sm transition-colors">
              Посмотреть другие сборки ПК
            </Link>
            {isAuthenticated ? (
              <button onClick={handleCopyBuild} disabled={copyingBuild}
                className="flex-1 py-2.5 px-4 bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {copyingBuild ? <span className="w-4 h-4 border-2 border-th-text border-t-transparent rounded-full animate-spin" /> : <Copy size={16} />}
                Собрать свой ПК
              </button>
            ) : (
              <Link to="/login"
                className="flex-1 text-center py-2.5 px-4 bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold rounded-lg text-sm transition-colors">
                Собрать свой ПК
              </Link>
            )}
          </div>

          {/* Comments section */}
          <div className="bg-th-surface border border-th-border rounded-lg p-5">
            <h3 className="text-th-text font-semibold mb-4">Комментарии</h3>
            <p className="text-th-muted text-sm">Ещё никто не написал. Вы можете быть первым!</p>
            {isAuthenticated ? (
              <div className="mt-4">
                <textarea
                  className="input-field resize-none h-20 text-sm w-full"
                  placeholder="Написать комментарий..."
                  disabled
                />
                <p className="text-th-muted text-xs mt-1">Функция комментариев в разработке</p>
              </div>
            ) : (
              <Link to="/login" className="mt-3 inline-block text-[#FF6B00] text-sm hover:underline">
                Войдите, чтобы оставить комментарий
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT: author sidebar */}
        <div className="space-y-4 lg:sticky lg:top-4">
          {/* Author card */}
          <div className="bg-th-surface border border-th-border rounded-lg p-4 text-center">
            <div className="mb-3">
              {build.author.avatar_url ? (
                <img src={build.author.avatar_url} alt={build.author.name}
                  className="w-16 h-16 rounded-full object-cover mx-auto" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#FF6B00]/20 border-2 border-[#FF6B00]/40 flex items-center justify-center mx-auto text-2xl font-bold text-[#FF6B00]">
                  {build.author.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <p className="text-th-text font-medium text-sm">{build.author.name}</p>
            {build.workshop && (
              <p className="text-th-text-2 text-xs mt-1">{build.workshop.name}, {build.workshop.city}</p>
            )}
            <div className="mt-4">
              <button
                onClick={() => toast('Функция в разработке', { icon: '🔧' })}
                className="w-full bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Заказать ПК
              </button>
            </div>
          </div>

          {/* Build info */}
          <div className="bg-th-surface border border-th-border rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-th-text-2">Компонентов</span>
              <span className="text-th-text">{build.items.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-th-text-2">Создано</span>
              <span className="text-th-text text-xs">{formatDate(build.created_at)}</span>
            </div>
            {(build.labor_cost ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-th-text-2">Работа</span>
                <span className="text-[#FF6B00]">{formatPrice(build.labor_cost ?? 0)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BuildPage
