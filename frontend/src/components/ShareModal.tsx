import React, { useState } from 'react'
import { X } from 'lucide-react'

interface ShareModalProps {
  url: string
  onClose: () => void
}

const ShareModal: React.FC<ShareModalProps> = ({ url, onClose }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const encoded = encodeURIComponent(url)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-th-surface border border-th-border rounded-xl p-6 w-full max-w-sm mx-4 relative"
           onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-th-text-2 hover:text-th-text transition-colors">
          <X size={18} />
        </button>
        <h3 className="text-th-text font-semibold mb-4">Поделиться ссылкой на сборку</h3>
        {/* Social buttons */}
        <div className="flex gap-3 mb-4 justify-center">
          <a href={`https://vk.com/share.php?url=${encoded}`} target="_blank" rel="noopener noreferrer"
             className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
             style={{ background: '#0077ff' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14C20.67 22 22 20.67 22 15.07V8.93C22 3.33 20.67 2 15.07 2zm3.08 13.96h-1.5c-.57 0-.74-.45-1.76-1.49-.88-.86-1.26-.98-1.48-.98-.3 0-.38.08-.38.49v1.36c0 .35-.11.56-1.03.56-1.52 0-3.2-.92-4.38-2.63-1.78-2.5-2.27-4.37-2.27-4.75 0-.22.08-.42.49-.42h1.5c.37 0 .51.17.65.57.72 2.07 1.92 3.88 2.42 3.88.19 0 .27-.09.27-.57V9.55c-.06-1.02-.6-1.11-.6-1.47 0-.18.15-.36.38-.36h2.36c.31 0 .42.17.42.53v2.87c0 .31.14.42.23.42.19 0 .35-.11.69-.46 1.07-1.2 1.83-3.04 1.83-3.04.1-.22.3-.42.67-.42h1.5c.45 0 .55.23.45.54-.19.87-2.02 3.46-2.02 3.46-.16.26-.22.38 0 .67.16.22.68.67 1.03 1.08.64.73 1.13 1.34 1.26 1.77.13.42-.09.64-.5.64z"/>
            </svg>
          </a>
          <a href={`https://t.me/share/url?url=${encoded}`} target="_blank" rel="noopener noreferrer"
             className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
             style={{ background: '#2ca5e0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </a>
          <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer"
             className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
             style={{ background: '#25d366' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.534 5.852L0 24l6.334-1.509A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.029-1.384l-.36-.213-3.757.895.952-3.653-.234-.374A9.818 9.818 0 1 1 12 21.818z"/>
            </svg>
          </a>
        </div>
        {/* URL copy */}
        <div className="flex gap-2">
          <input
            value={url} readOnly
            className="flex-1 bg-th-surface-3 border border-th-border rounded-lg px-3 py-2 text-th-text text-sm focus:outline-none"
          />
          <button onClick={handleCopy}
            className="bg-[#FF6B00] hover:bg-[#E05A00] text-white px-3 py-2 rounded-lg text-sm transition-colors shrink-0">
            {copied ? '✓' : 'Копировать'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShareModal
