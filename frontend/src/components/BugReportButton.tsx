import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, ImagePlus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { client } from '../api/client'

/* ======= Ladybug SVG ======= */
const LadybugSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="19" rx="7" ry="8" fill="#E53E3E" />
    <line x1="16" y1="11" x2="16" y2="27" stroke="#1a1a2e" strokeWidth="1.2" />
    <circle cx="13" cy="16" r="1.3" fill="#1a1a2e" />
    <circle cx="19" cy="16" r="1.3" fill="#1a1a2e" />
    <circle cx="13" cy="21" r="1.1" fill="#1a1a2e" />
    <circle cx="19" cy="21" r="1.1" fill="#1a1a2e" />
    <circle cx="16" cy="11" r="3.5" fill="#2D3748" />
    <circle cx="14.5" cy="10" r="1" fill="#FF6B00" />
    <circle cx="17.5" cy="10" r="1" fill="#FF6B00" />
    <line x1="14" y1="8" x2="11" y2="4" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="18" y1="8" x2="21" y2="4" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="11" cy="4" r="1" fill="#FF6B00" />
    <circle cx="21" cy="4" r="1" fill="#FF6B00" />
    <line x1="9" y1="15" x2="6" y2="13" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="9" y1="19" x2="5" y2="19" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="9" y1="23" x2="6" y2="25" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="23" y1="15" x2="26" y2="13" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="23" y1="19" x2="27" y2="19" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="23" y1="23" x2="26" y2="25" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

/* ======= Crawl Animation Controller ======= */
const BugCrawler: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  // Phase: 'enter' → 'crawl-out' → 'peek' → 'idle' → (hourly) 'wander' → 'idle'
  const [phase, setPhase] = useState<'enter' | 'crawl-out' | 'peek' | 'idle' | 'wander'>('enter')
  const btnRef = useRef<HTMLButtonElement>(null)
  const wanderTimer = useRef<ReturnType<typeof setTimeout>>()

  const scheduleWander = useCallback(() => {
    // Random 45-60 min
    const delay = (45 + Math.random() * 15) * 60 * 1000
    wanderTimer.current = setTimeout(() => {
      setPhase('wander')
    }, delay)
  }, [])

  useEffect(() => {
    // Initial sequence: enter visible → 3s → crawl out → 1.5s → peek back
    const t1 = setTimeout(() => setPhase('crawl-out'), 3000)
    const t2 = setTimeout(() => setPhase('peek'), 5000)
    const t3 = setTimeout(() => {
      setPhase('idle')
      scheduleWander()
    }, 6500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(wanderTimer.current) }
  }, [scheduleWander])

  // After wander finishes, return to idle
  useEffect(() => {
    if (phase === 'wander') {
      const t = setTimeout(() => {
        setPhase('idle')
        scheduleWander()
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [phase, scheduleWander])

  // Position styles per phase
  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 50,
      transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
    }
    switch (phase) {
      case 'enter':
        return { ...base, bottom: 20, right: 20, transform: 'rotate(-15deg) scale(1)', opacity: 1 }
      case 'crawl-out':
        return { ...base, bottom: -10, right: -10, transform: 'rotate(45deg) scale(0.8)', opacity: 0.5, transition: 'all 1.8s cubic-bezier(0.4, 0, 0.2, 1)' }
      case 'peek':
        return { ...base, bottom: -8, right: -8, transform: 'rotate(40deg) scale(0.85)', opacity: 0.7, transition: 'all 1.2s ease-out' }
      case 'wander':
        // Random direction
        const dirs = [
          { bottom: 80, right: 60, transform: 'rotate(-20deg) scale(1)' },
          { bottom: 40, right: 100, transform: 'rotate(-30deg) scale(0.95)' },
          { bottom: 120, right: 30, transform: 'rotate(10deg) scale(1)' },
        ]
        const d = dirs[Math.floor(Math.random() * dirs.length)]
        return { ...base, ...d, opacity: 1, transition: 'all 2s cubic-bezier(0.4, 0, 0.2, 1)' }
      case 'idle':
      default:
        return { ...base, bottom: -6, right: -6, transform: 'rotate(40deg) scale(0.85)', opacity: 0.65 }
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={onClick}
        onMouseEnter={() => {
          if (btnRef.current) {
            btnRef.current.style.transform = 'rotate(-15deg) scale(1.1)'
            btnRef.current.style.opacity = '1'
            btnRef.current.style.bottom = '16px'
            btnRef.current.style.right = '16px'
          }
        }}
        onMouseLeave={() => {
          if (btnRef.current && phase === 'idle') {
            btnRef.current.style.transform = 'rotate(40deg) scale(0.85)'
            btnRef.current.style.opacity = '0.65'
            btnRef.current.style.bottom = '-6px'
            btnRef.current.style.right = '-6px'
          }
        }}
        style={getStyle()}
        title="Нашли баг?"
        className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center active:scale-95"
      >
        <LadybugSVG className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-lg animate-bug-idle" />
      </button>
      <style>{`
        @keyframes bug-idle {
          0%, 85%, 100% { transform: rotate(0deg); }
          88% { transform: rotate(-3deg) translateY(-1px); }
          91% { transform: rotate(3deg) translateY(0); }
          94% { transform: rotate(-2deg); }
          97% { transform: rotate(2deg); }
        }
        .animate-bug-idle { animation: bug-idle 5s ease-in-out infinite; }
      `}</style>
    </>
  )
}

const BugReportButton: React.FC = () => {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Опишите баг')
      return
    }
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('description', description.trim())
      fd.append('page_url', window.location.href)
      fd.append('user_agent', navigator.userAgent)
      if (!user && name.trim()) fd.append('reporter_name', name.trim())
      if (screenshot) fd.append('screenshot', screenshot)

      await client.post('/api/bugs/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Спасибо! Баг-репорт отправлен')
      setOpen(false)
      setDescription('')
      setName('')
      setScreenshot(null)
      setPreview(null)
    } catch {
      toast.error('Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Floating ladybug button with crawl animation */}
      <BugCrawler onClick={() => setOpen(true)} />

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative bg-th-surface border border-th-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-md mx-auto p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-th-text font-semibold text-lg flex items-center gap-2">
                <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
                  <ellipse cx="16" cy="19" rx="7" ry="8" fill="#E53E3E" />
                  <circle cx="16" cy="11" r="3.5" fill="#2D3748" />
                  <circle cx="14.5" cy="10" r="1" fill="#FF6B00" />
                  <circle cx="17.5" cy="10" r="1" fill="#FF6B00" />
                </svg>
                Нашли баг?
              </h3>
              <button onClick={() => setOpen(false)} className="text-th-text-2 hover:text-th-text transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {!user && (
                <div>
                  <label className="block text-sm text-th-text-2 mb-1">Ваше имя</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    placeholder="Необязательно"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-th-text-2 mb-1">Описание бага *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field min-h-[100px] resize-y"
                  placeholder="Что пошло не так? Какие шаги привели к ошибке?"
                  maxLength={2000}
                />
                <p className="text-th-muted text-xs mt-1">{description.length}/2000</p>
              </div>

              <div>
                <label className="block text-sm text-th-text-2 mb-1">Скриншот</label>
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="Preview" className="w-full max-h-40 object-contain rounded-lg border border-th-border" />
                    <button
                      onClick={() => { setScreenshot(null); setPreview(null) }}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full border border-dashed border-th-border rounded-lg p-4 flex items-center justify-center gap-2 text-th-text-2 hover:border-[#FF6B00] hover:text-[#FF6B00] transition-colors text-sm"
                  >
                    <ImagePlus size={18} />
                    Прикрепить скриншот
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </div>

              <button
                onClick={handleSubmit}
                disabled={sending || !description.trim()}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BugReportButton
