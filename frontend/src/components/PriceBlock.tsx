import React from 'react'

interface PriceBlockProps {
  hardwareTotal: number
  totalPrice: number       // hardware + labor %
  laborCost: number
  laborPercent: number
  laborPriceManual?: number | null
}

const fmt = (price: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(price)

const PriceBlock: React.FC<PriceBlockProps> = ({
  hardwareTotal,
  totalPrice,
  laborCost,
  laborPercent,
  laborPriceManual,
}) => {
  const hasTurnkey = laborPriceManual != null && laborPriceManual > 0

  return (
    <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-th-border">
        <span className="text-th-text-2 text-sm">Стоимость комплектующих</span>
        <span className="text-th-text font-medium">{fmt(hardwareTotal)}</span>
      </div>

      <div className="px-4 py-3 flex items-center justify-between border-b border-th-border">
        <span className="text-th-text-2 text-sm">
          Стоимость работы <span className="text-xs">({laborPercent}%)</span>
        </span>
        <span className="text-th-text font-medium">{fmt(laborCost)}</span>
      </div>

      <div className="px-4 py-3 flex items-center justify-between bg-th-surface-2 border-b border-th-border">
        <span className="text-th-text font-semibold text-sm">Итоговая стоимость:</span>
        <span className="text-th-text font-bold text-lg">{fmt(totalPrice)}</span>
      </div>

      {/* Turnkey — от мастерской */}
      {hasTurnkey && (
        <div className="px-4 py-4 bg-[#FF6B00]/10 border-t border-[#FF6B00]/30">
          <div className="flex items-center justify-between">
            <span className="text-[#FF6B00] font-bold text-sm">Стоимость компьютера от мастерской HappyPC</span>
            <span className="text-[#FF6B00] font-bold text-xl">{fmt(laborPriceManual!)}</span>
          </div>
          <p className="text-th-text-3 text-[11px] mt-1">Полностью собранный и настроенный ПК с установленной ОС и гарантией 1 год</p>
        </div>
      )}
    </div>
  )
}

export default PriceBlock
