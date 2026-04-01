import React, { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bug, Trash2, ExternalLink, ImagePlus, Send, X, ChevronRight,
  MessageSquare, Settings, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { client } from '../../api/client'
import { getSettings, updateSettings } from '../../api/admin'

interface BugComment {
  id: string
  author_name: string
  text: string
  screenshots: string[]
  new_status: string | null
  created_at: string
}

interface BugItem {
  id: string
  description: string
  screenshot_url: string | null
  page_url: string | null
  reporter_name: string
  status: string
  created_at: string
  comments: BugComment[]
}

const STATUSES = [
  { key: 'new', label: 'Новые', emoji: '🆕', color: 'border-blue-500/40 bg-blue-500/5' },
  { key: 'in_progress', label: 'В работе', emoji: '🔧', color: 'border-yellow-500/40 bg-yellow-500/5' },
  { key: 'done', label: 'Выполнено', emoji: '✅', color: 'border-green-500/40 bg-green-500/5' },
  { key: 'needs_rework', label: 'Доработка', emoji: '⚠️', color: 'border-red-500/40 bg-red-500/5' },
]

const statusLabel = (s: string) => STATUSES.find((x) => x.key === s)?.label || s
const statusEmoji = (s: string) => STATUSES.find((x) => x.key === s)?.emoji || ''

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const BugsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'kanban' | 'settings'>('kanban')
  const [selectedBug, setSelectedBug] = useState<BugItem | null>(null)
  const [viewImage, setViewImage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: bugs, isLoading } = useQuery<BugItem[]>({
    queryKey: ['admin-bugs'],
    queryFn: async () => (await client.get('/api/admin/bugs')).data,
  })

  const handleDelete = async (bug: BugItem) => {
    if (!confirm('Удалить баг-репорт?')) return
    try {
      await client.delete(`/api/admin/bugs/${bug.id}`)
      await queryClient.invalidateQueries({ queryKey: ['admin-bugs'] })
      if (selectedBug?.id === bug.id) setSelectedBug(null)
      toast.success('Удалён')
    } catch { toast.error('Ошибка') }
  }

  const handleStatusChange = async (bug: BugItem, newStatus: string) => {
    try {
      await client.patch(`/api/admin/bugs/${bug.id}`, { status: newStatus })
      await queryClient.invalidateQueries({ queryKey: ['admin-bugs'] })
      if (selectedBug?.id === bug.id) {
        setSelectedBug({ ...selectedBug, status: newStatus })
      }
    } catch { toast.error('Ошибка') }
  }

  const filteredBugs = (status: string) =>
    bugs?.filter((b) => b.status === status) || []

  const allFiltered = statusFilter === 'all'
    ? bugs || []
    : bugs?.filter((b) => b.status === statusFilter) || []

  const openCount = bugs?.filter((b) => b.status === 'new').length ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-text flex items-center gap-2">
            <Bug size={24} /> Баги
          </h1>
          <p className="text-th-text-2 text-sm mt-1">
            {openCount > 0 && <span className="text-red-400 font-medium">{openCount} новых</span>}
            {bugs && <span className="text-th-text-3"> · {bugs.length} всего</span>}
          </p>
        </div>
        <div className="flex gap-1 bg-th-surface border border-th-border rounded-lg p-0.5">
          <button onClick={() => setTab('kanban')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${tab === 'kanban' ? 'bg-[#FF6B00] text-white' : 'text-th-text-2'}`}>
            Баги
          </button>
          <button onClick={() => setTab('settings')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${tab === 'settings' ? 'bg-[#FF6B00] text-white' : 'text-th-text-2'}`}>
            <Settings size={12} /> Настройки
          </button>
        </div>
      </div>

      {tab === 'settings' && <BugSettings />}

      {tab === 'kanban' && (
        <>
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusFilter === 'all' ? 'border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]' : 'border-th-border text-th-text-2'}`}>
              Все ({bugs?.length || 0})
            </button>
            {STATUSES.map((s) => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusFilter === s.key ? 'border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]' : 'border-th-border text-th-text-2'}`}>
                {s.emoji} {s.label} ({filteredBugs(s.key).length})
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-20 bg-th-surface border border-th-border rounded-lg animate-pulse" />)}
            </div>
          ) : allFiltered.length === 0 ? (
            <div className="bg-th-surface border border-th-border rounded-lg p-12 text-center text-th-text-2">
              <Bug size={40} className="mx-auto mb-3 opacity-30" />
              <p>Нет баг-репортов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allFiltered.map((bug) => {
                const st = STATUSES.find((s) => s.key === bug.status)
                return (
                  <div key={bug.id}
                    className={`bg-th-surface border rounded-lg p-4 cursor-pointer hover:border-[#FF6B00]/40 transition-colors ${st?.color || 'border-th-border'}`}
                    onClick={() => setSelectedBug(bug)}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-th-text text-sm line-clamp-2">{bug.description}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-th-text-3">
                          <span>{statusEmoji(bug.status)} {statusLabel(bug.status)}</span>
                          <span>{bug.reporter_name}</span>
                          <span>{formatDate(bug.created_at)}</span>
                          {bug.comments.length > 0 && (
                            <span className="flex items-center gap-0.5"><MessageSquare size={10} />{bug.comments.length}</span>
                          )}
                          {bug.screenshot_url && <span>📎 Скриншот</span>}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-th-text-3 shrink-0 mt-1" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Bug detail modal */}
      {selectedBug && (
        <BugDetailModal
          bug={selectedBug}
          onClose={() => setSelectedBug(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onViewImage={setViewImage}
          onRefresh={async () => {
            await queryClient.invalidateQueries({ queryKey: ['admin-bugs'] })
            const updated = (await client.get('/api/admin/bugs')).data as BugItem[]
            const fresh = updated.find((b: BugItem) => b.id === selectedBug.id)
            if (fresh) setSelectedBug(fresh)
          }}
        />
      )}

      {/* Image viewer */}
      {viewImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80" onClick={() => setViewImage(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setViewImage(null)}>
            <X size={28} />
          </button>
          <img src={viewImage} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}

/* ============= Bug Detail Modal ============= */

interface BugDetailModalProps {
  bug: BugItem
  onClose: () => void
  onStatusChange: (bug: BugItem, status: string) => void
  onDelete: (bug: BugItem) => void
  onViewImage: (url: string) => void
  onRefresh: () => Promise<void>
}

const BugDetailModal: React.FC<BugDetailModalProps> = ({ bug, onClose, onStatusChange, onDelete, onViewImage, onRefresh }) => {
  const [commentText, setCommentText] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAddComment = async () => {
    if (!commentText.trim()) { toast.error('Введите комментарий'); return }
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('text', commentText.trim())
      if (newStatus) fd.append('new_status', newStatus)
      files.forEach((f) => fd.append('screenshots', f))
      await client.post(`/api/admin/bugs/${bug.id}/comments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setCommentText('')
      setNewStatus('')
      setFiles([])
      await onRefresh()
      toast.success('Комментарий добавлен')
    } catch { toast.error('Ошибка') }
    finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-th-surface border border-th-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg mx-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-th-border shrink-0">
          <h3 className="text-th-text font-semibold text-sm flex items-center gap-2">
            {statusEmoji(bug.status)} Баг #{bug.id.slice(0, 8)}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => onDelete(bug)} className="p-1.5 text-red-400 hover:bg-red-900/20 rounded" title="Удалить">
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="p-1.5 text-th-text-2 hover:text-th-text rounded"><X size={16} /></button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Description */}
          <div>
            <p className="text-th-text text-sm">{bug.description}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-th-text-3">
              <span>От: {bug.reporter_name}</span>
              <span>{formatDate(bug.created_at)}</span>
              {bug.page_url && (
                <a href={bug.page_url} target="_blank" rel="noopener noreferrer" className="text-[#FF6B00] hover:underline flex items-center gap-0.5">
                  <ExternalLink size={10} /> Страница
                </a>
              )}
            </div>
            {bug.screenshot_url && (
              <img src={bug.screenshot_url} alt="Screenshot" className="mt-3 rounded-lg border border-th-border max-h-40 object-contain cursor-pointer hover:opacity-80"
                onClick={() => onViewImage(bug.screenshot_url!)} />
            )}
          </div>

          {/* Status pills */}
          <div>
            <label className="text-xs text-th-text-3 mb-1.5 block">Статус</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s.key} onClick={() => onStatusChange(bug, s.key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    bug.status === s.key ? 'border-[#FF6B00] bg-[#FF6B00]/15 text-[#FF6B00]' : 'border-th-border text-th-text-2 hover:border-th-muted'
                  }`}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          {bug.comments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs text-th-text-3 font-medium uppercase">Комментарии ({bug.comments.length})</h4>
              {bug.comments.map((c) => (
                <div key={c.id} className="bg-th-surface-2 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-th-text text-xs font-medium">{c.author_name}</span>
                    <span className="text-th-text-3 text-[10px]">{formatDate(c.created_at)}</span>
                  </div>
                  {c.new_status && (
                    <p className="text-xs mb-1">
                      <span className="text-th-text-3">Статус →</span>{' '}
                      <span className="font-medium">{statusEmoji(c.new_status)} {statusLabel(c.new_status)}</span>
                    </p>
                  )}
                  <p className="text-th-text-2 text-sm whitespace-pre-wrap">{c.text}</p>
                  {c.screenshots.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {c.screenshots.map((url, i) => (
                        <img key={i} src={url} alt="" className="h-16 rounded border border-th-border cursor-pointer hover:opacity-80 object-cover"
                          onClick={() => onViewImage(url)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add comment form */}
          <div className="border-t border-th-border pt-4">
            <h4 className="text-xs text-th-text-3 font-medium uppercase mb-2">Добавить комментарий</h4>
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
              className="input-field min-h-[80px] resize-y text-sm" placeholder="Комментарий..." maxLength={2000} />

            <div className="flex items-center gap-2 mt-2">
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                className="select-field text-xs flex-1">
                <option value="">Без смены статуса</option>
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
                ))}
              </select>
              <button onClick={() => fileRef.current?.click()}
                className="p-2 text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 rounded transition-colors" title="Скриншоты">
                <ImagePlus size={16} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
            </div>

            {files.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="h-12 rounded border border-th-border object-cover" />
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleAddComment} disabled={sending || !commentText.trim()}
              className="btn-primary w-full mt-3 flex items-center justify-center gap-2 py-2">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============= Bug Settings ============= */

const BugSettings: React.FC = () => {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['admin-settings'], queryFn: getSettings })
  const [botToken, setBotToken] = useState('')
  const [chatIds, setChatIds] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (settings && !loaded) {
    setBotToken(settings.bug_telegram_bot_token || '')
    setChatIds(settings.bug_telegram_chat_id || '')
    setLoaded(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({ bug_telegram_bot_token: botToken, bug_telegram_chat_id: chatIds })
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      toast.success('Настройки сохранены')
    } catch { toast.error('Ошибка') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-th-surface border border-th-border rounded-lg p-4 sm:p-5 max-w-lg space-y-4">
      <h2 className="text-th-text font-semibold text-sm">Уведомления в Telegram</h2>
      <p className="text-th-text-3 text-xs">При новом баг-репорте или смене статуса бот отправит сообщение в указанные чаты.</p>
      <div>
        <label className="block text-sm text-th-text-2 mb-1">Токен бота</label>
        <input value={botToken} onChange={(e) => setBotToken(e.target.value)}
          className="input-field" placeholder="123456:ABC-DEF..." />
        <p className="text-th-muted text-xs mt-1">Создайте бота через @BotFather</p>
      </div>
      <div>
        <label className="block text-sm text-th-text-2 mb-1">Chat ID получателей</label>
        <input value={chatIds} onChange={(e) => setChatIds(e.target.value)}
          className="input-field" placeholder="123456789, 987654321" />
        <p className="text-th-muted text-xs mt-1">Через запятую. Узнать свой Chat ID: @userinfobot</p>
      </div>
      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-4">
        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
        Сохранить
      </button>
    </div>
  )
}

export default BugsPage
