import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Download, Share2, Copy, Lock, ExternalLink, Edit, ChevronDown, ChevronUp, X,
  ThumbsUp, MessageSquare, Eye, Send, Reply, Edit2, Trash2, Pencil, Printer,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getPublicBuild, downloadPDF, copyBuild, deleteBuild } from '../api/builds'
import { getComments, createComment, editComment, deleteComment, getBuildStats, toggleLike, recordView, checkLiked } from '../api/social'
import type { Comment } from '../api/social'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { useStores, detectStoreFromList } from '../hooks/useStores'
import CategoryIcon from '../components/CategoryIcon'
import PriceBlock from '../components/PriceBlock'
import ShareModal from '../components/ShareModal'
import StoreBadge from '../components/StoreBadge'
import type { StoreInfo } from '../types'

function StoreIcon({ url, stores }: { url: string | null; stores: StoreInfo[] }) {
  if (!url) return null
  const store = detectStoreFromList(url, stores)
  if (!store) return null
  return <StoreBadge store={store} size="sm" />
}

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

const formatPrice = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

interface PasswordForm { password: string }

// ─── Components table section ─────────────────────────────────────────────────
function ComponentsSection({ items, stores }: { items: { id: string; category: string; name: string; url: string | null; price: number; sort_order: number }[]; stores: StoreInfo[] }) {
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
                        <StoreIcon url={item.url} stores={stores} />
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
  const { can } = usePermissions()
  const { data: stores = [] } = useStores()
  const [password, setPassword] = useState<string | undefined>(undefined)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [copyingBuild, setCopyingBuild] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<PasswordForm>()

  const queryClient = useQueryClient()

  const { data: build, isLoading, error, refetch } = useQuery({
    queryKey: ['public-build', short_code, password],
    queryFn: () => getPublicBuild(short_code!, password),
    enabled: !!short_code,
    retry: false,
  })

  const buildId = build?.id
  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['build-comments', buildId],
    queryFn: () => getComments(buildId!),
    enabled: !!buildId,
  })
  const { data: stats } = useQuery({
    queryKey: ['build-stats', buildId],
    queryFn: () => getBuildStats(buildId!),
    enabled: !!buildId,
  })
  const { data: isLiked } = useQuery({
    queryKey: ['build-liked', buildId],
    queryFn: () => checkLiked(buildId!),
    enabled: !!buildId && isAuthenticated,
  })

  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [editingComment, setEditingComment] = useState<{ id: string; text: string } | null>(null)

  // Sync liked state
  React.useEffect(() => {
    if (isLiked !== undefined) setLiked(isLiked)
  }, [isLiked])
  React.useEffect(() => {
    if (stats) setLikesCount(stats.likes)
  }, [stats])
  // Record view
  React.useEffect(() => {
    if (buildId) recordView(buildId)
  }, [buildId])

  // Scroll to #comments if hash present
  React.useEffect(() => {
    if (build && window.location.hash === '#comments') {
      setTimeout(() => {
        document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [build])

  const handleLike = async () => {
    if (!isAuthenticated) { toast.error('Войдите, чтобы поставить лайк'); return }
    if (!can('can_like')) { toast.error('Недостаточно прав'); return }
    try {
      const result = await toggleLike(buildId!)
      setLiked(result.liked)
      setLikesCount(result.count)
    } catch { toast.error('Ошибка') }
  }

  const handleComment = async () => {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      await createComment(buildId!, commentText.trim(), replyTo?.id)
      setCommentText('')
      setReplyTo(null)
      await refetchComments()
      toast.success('Комментарий добавлен')
    } catch { toast.error('Ошибка') }
    finally { setSubmittingComment(false) }
  }

  const handleEditComment = async () => {
    if (!editingComment || !editingComment.text.trim()) return
    try {
      await editComment(editingComment.id, editingComment.text.trim())
      setEditingComment(null)
      await refetchComments()
      toast.success('Комментарий обновлён')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'Ошибка редактирования')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Удалить комментарий?')) return
    try {
      await deleteComment(commentId)
      await refetchComments()
      toast.success('Комментарий удалён')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || 'Ошибка')
    }
  }

  const canEdit = (c: Comment) => {
    if (c.user_id !== user?.id) return false
    const diff = (Date.now() - new Date(c.created_at).getTime()) / 1000
    return diff <= 120 // 2 minutes
  }

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
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const canDelete = isOwner || isAdmin
  const [deletingBuild, setDeletingBuild] = useState(false)

  const handleDeleteBuild = async () => {
    if (!build) return
    if (!confirm(`Удалить сборку «${build.title}»? Это действие нельзя отменить.`)) return
    setDeletingBuild(true)
    try {
      await deleteBuild(build.id)
      toast.success('Сборка удалена')
      navigate('/', { replace: true })
    } catch {
      toast.error('Ошибка при удалении сборки')
      setDeletingBuild(false)
    }
  }

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
    <div>
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
          <div className="flex items-center gap-3 mt-1">
            <p className="text-th-muted text-xs">Обновлено: {formatDate(build.updated_at)}</p>
            {build.tags && build.tags.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-th-border">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{
                    background: build.tags.includes('белый') ? '#ffffff' : '#222222',
                    border: build.tags.includes('белый') ? '1.5px solid #ccc' : '1.5px solid #444',
                  }}
                />
                <span className="text-th-text-2">{build.tags.includes('белый') ? 'Белая сборка' : 'Чёрная сборка'}</span>
              </span>
            )}
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {isOwner && (
            <Link to={`/builds/${build.id}/edit`}
              className="flex items-center gap-1.5 bg-th-surface-2 hover:bg-th-border text-th-text px-3 py-2 rounded-lg text-sm transition-colors">
              <Edit size={14} />Редактировать
            </Link>
          )}
          {isAuthenticated && can('can_copy_build') && (
            <button onClick={handleCopyBuild} disabled={copyingBuild}
              className="flex items-center gap-1.5 bg-th-surface-2 hover:bg-th-border text-th-text px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
              {copyingBuild ? <span className="w-3.5 h-3.5 border-2 border-th-text border-t-transparent rounded-full animate-spin" /> : <Copy size={14} />}
              Копировать сборку
            </button>
          )}
          <button onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 bg-th-surface-2 hover:bg-th-border text-th-text px-3 py-2 rounded-lg text-sm transition-colors">
            <Share2 size={14} />Поделиться
          </button>
          {can('can_download_pdf') && (
            <button onClick={handleDownloadPDF} disabled={pdfLoading}
              className="flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E05A00] text-white px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
              {pdfLoading ? <span className="w-3.5 h-3.5 border-2 border-th-text border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
              Скачать PDF
            </button>
          )}
          {isAuthenticated && can('can_print') && (
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`/api/public/${build.short_code}/pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                  const blob = await response.blob()
                  const url = URL.createObjectURL(blob)
                  const printWindow = window.open(url)
                  if (printWindow) {
                    printWindow.onload = () => { printWindow.print() }
                  }
                } catch { toast.error('Ошибка печати') }
              }}
              className="flex items-center gap-1.5 bg-th-surface-2 hover:bg-th-border text-th-text px-3 py-2 rounded-lg text-sm transition-colors">
              <Printer size={14} />Печать
            </button>
          )}
          {canDelete && (
            <button onClick={handleDeleteBuild} disabled={deletingBuild}
              className="flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 border border-red-600/30 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
              {deletingBuild ? <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
              Удалить
            </button>
          )}
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
          <ComponentsSection items={build.items} stores={stores} />

          {/* Price block */}
          <PriceBlock
            hardwareTotal={build.hardware_total ?? build.total_price}
            totalPrice={build.total_price}
            laborCost={build.labor_cost ?? 0}
            laborPercent={build.labor_percent}
            laborPriceManual={build.labor_price_manual}
            installOS={build.install_os}
          />

          {/* Back to builds */}
          <div className="mb-6">
            <Link to="/"
              className="text-th-text-2 hover:text-[#FF6B00] text-sm transition-colors">
              ← Все сборки
            </Link>
          </div>

          {/* Comments section */}
          <div className="bg-th-surface border border-th-border rounded-lg p-5" id="comments">
            <h3 className="text-th-text font-semibold mb-4 flex items-center gap-2">
              <MessageSquare size={18} />
              Комментарии
              {stats && stats.comments > 0 && (
                <span className="text-th-text-3 text-sm font-normal">({stats.comments})</span>
              )}
            </h3>

            {/* Comment form */}
            {isAuthenticated ? (
              <div className="mb-5">
                {replyTo && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-th-text-2 bg-th-surface-2 rounded px-3 py-1.5">
                    <Reply size={12} />
                    <span>Ответ для <strong>{replyTo.name}</strong></span>
                    <button onClick={() => setReplyTo(null)} className="text-th-muted hover:text-th-text ml-auto">
                      <X size={12} />
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <textarea
                    value={commentText}
                    onChange={e => {
                      setCommentText(e.target.value)
                      // Auto-resize: min 2 rows, max 6 rows
                      const el = e.target
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, 144) + 'px'
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment() } }}
                    className="input-field text-sm w-full resize-none overflow-hidden"
                    style={{ minHeight: '52px', maxHeight: '144px' }}
                    placeholder={replyTo ? `Ответить ${replyTo.name}...` : 'Написать комментарий...'}
                    maxLength={2000}
                    rows={2}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-th-muted text-[10px]">{commentText.length}/2000</span>
                    <button
                      onClick={handleComment}
                      disabled={submittingComment || !commentText.trim()}
                      className="bg-[#FF6B00] hover:bg-[#E05A00] text-white px-5 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                    >
                      {submittingComment
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <><Send size={15} />Отправить</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <Link to="/login" className="text-[#FF6B00] text-sm hover:underline">
                  Войдите, чтобы оставить комментарий
                </Link>
              </div>
            )}

            {/* Comments list */}
            {comments && comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map(c => (
                  <div key={c.id}>
                    {/* Main comment */}
                    {c.is_deleted ? (
                      <div className="flex gap-3 opacity-60">
                        <div className="w-8 h-8 rounded-full bg-th-surface-2 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-th-muted text-sm italic">
                            {c.user_name} удалил(а) свой комментарий
                            {c.deleted_at && <span className="text-xs ml-1">({new Date(c.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })})</span>}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        {c.user_avatar ? (
                          <img src={c.user_avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-xs font-bold text-[#FF6B00] shrink-0 mt-0.5">
                            {c.user_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-th-text text-sm font-medium">{c.user_name}</span>
                            <span className="text-th-muted text-xs">
                              {new Date(c.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {c.is_edited && <span className="text-th-muted text-[10px] italic">(изменён)</span>}
                          </div>

                          {/* Edit mode */}
                          {editingComment?.id === c.id ? (
                            <div className="mt-1 flex gap-2">
                              <input
                                type="text"
                                value={editingComment.text}
                                onChange={e => setEditingComment({ ...editingComment, text: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && handleEditComment()}
                                className="input-field text-sm flex-1"
                                autoFocus
                              />
                              <button onClick={handleEditComment} className="text-[#FF6B00] hover:text-[#E05A00] text-xs font-medium">Сохранить</button>
                              <button onClick={() => setEditingComment(null)} className="text-th-muted hover:text-th-text text-xs">Отмена</button>
                            </div>
                          ) : (
                            <p className="text-th-text-2 text-sm mt-1">{c.text}</p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-3 mt-1">
                            {isAuthenticated && (
                              <button
                                onClick={() => setReplyTo({ id: c.id, name: c.user_name })}
                                className="text-th-muted hover:text-[#FF6B00] text-xs flex items-center gap-1 transition-colors"
                              >
                                <Reply size={11} /> Ответить
                              </button>
                            )}
                            {c.user_id === user?.id && canEdit(c) && (
                              <button
                                onClick={() => setEditingComment({ id: c.id, text: c.text || '' })}
                                className="text-th-muted hover:text-[#FF6B00] text-xs flex items-center gap-1 transition-colors"
                              >
                                <Pencil size={10} /> Изменить
                              </button>
                            )}
                            {c.user_id === user?.id && (
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                className="text-th-muted hover:text-red-400 text-xs flex items-center gap-1 transition-colors"
                              >
                                <Trash2 size={10} /> Удалить
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Replies */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="ml-11 mt-3 space-y-3 pl-3 border-l-2 border-th-border">
                        {c.replies.map(r => (
                          <div key={r.id}>
                            {r.is_deleted ? (
                              <p className="text-th-muted text-xs italic opacity-60">
                                {r.user_name} удалил(а) ответ
                              </p>
                            ) : (
                              <div className="flex gap-2.5">
                                {r.user_avatar ? (
                                  <img src={r.user_avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-[9px] font-bold text-[#FF6B00] shrink-0 mt-0.5">
                                    {r.user_name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-th-text text-xs font-medium">{r.user_name}</span>
                                    <span className="text-th-muted text-[10px]">
                                      {new Date(r.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {r.is_edited && <span className="text-th-muted text-[10px] italic">(изм.)</span>}
                                  </div>
                                  <p className="text-th-text-2 text-xs mt-0.5">{r.text}</p>
                                  {r.user_id === user?.id && (
                                    <button
                                      onClick={() => handleDeleteComment(r.id)}
                                      className="text-th-muted hover:text-red-400 text-[10px] flex items-center gap-1 mt-0.5 transition-colors"
                                    >
                                      <Trash2 size={9} /> Удалить
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-th-muted text-sm">Комментариев пока нет. Будьте первым!</p>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default BuildPage
