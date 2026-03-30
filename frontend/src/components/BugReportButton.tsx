import React, { useState, useRef } from 'react'
import { X, Send, ImagePlus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { client } from '../api/client'

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
      {/* Floating ladybug button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
        style={{ background: 'rgba(30,30,40,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,107,0,0.3)' }}
        title="Нашли баг?"
      >
        <svg
          viewBox="0 0 32 32"
          className="w-6 h-6 sm:w-7 sm:h-7 animate-bug-wiggle"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Body */}
          <ellipse cx="16" cy="19" rx="7" ry="8" fill="#E53E3E" />
          {/* Wing line */}
          <line x1="16" y1="11" x2="16" y2="27" stroke="#1a1a2e" strokeWidth="1.2" />
          {/* Spots */}
          <circle cx="13" cy="16" r="1.3" fill="#1a1a2e" />
          <circle cx="19" cy="16" r="1.3" fill="#1a1a2e" />
          <circle cx="13" cy="21" r="1.1" fill="#1a1a2e" />
          <circle cx="19" cy="21" r="1.1" fill="#1a1a2e" />
          {/* Head */}
          <circle cx="16" cy="11" r="3.5" fill="#2D3748" />
          {/* Eyes */}
          <circle cx="14.5" cy="10" r="1" fill="#FF6B00" />
          <circle cx="17.5" cy="10" r="1" fill="#FF6B00" />
          {/* Antennae */}
          <line x1="14" y1="8" x2="11" y2="4" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="18" y1="8" x2="21" y2="4" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="11" cy="4" r="1" fill="#FF6B00" />
          <circle cx="21" cy="4" r="1" fill="#FF6B00" />
          {/* Legs */}
          <line x1="9" y1="15" x2="6" y2="13" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="9" y1="19" x2="5" y2="19" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="9" y1="23" x2="6" y2="25" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="23" y1="15" x2="26" y2="13" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="23" y1="19" x2="27" y2="19" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="23" y1="23" x2="26" y2="25" stroke="#2D3748" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* CSS animation */}
      <style>{`
        @keyframes bug-wiggle {
          0%, 90%, 100% { transform: rotate(0deg); }
          92% { transform: rotate(-4deg); }
          94% { transform: rotate(4deg); }
          96% { transform: rotate(-3deg); }
          98% { transform: rotate(3deg); }
        }
        .animate-bug-wiggle { animation: bug-wiggle 6s ease-in-out infinite; }
      `}</style>

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
