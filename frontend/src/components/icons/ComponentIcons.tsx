import React from 'react'

interface IconProps {
  size?: number
  color?: string
  className?: string
}

const defaultColor = '#FF6B00'

export const CPUIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="7" y="7" width="10" height="10" rx="1" stroke={color} strokeWidth="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="0.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1" />
    <line x1="9" y1="7" x2="9" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="7" x2="12" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="15" y1="7" x2="15" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="9" y1="20" x2="9" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="20" x2="12" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="15" y1="20" x2="15" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="9" x2="4" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="12" x2="4" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="15" x2="4" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="20" y1="9" x2="17" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="20" y1="12" x2="17" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="20" y1="15" x2="17" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const GPUIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="7" width="20" height="10" rx="1.5" stroke={color} strokeWidth="1.5" />
    <rect x="5" y="10" width="4" height="4" rx="0.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1" />
    <rect x="10" y="10" width="4" height="4" rx="0.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1" />
    <line x1="15" y1="10" x2="15" y2="14" stroke={color} strokeWidth="1" />
    <line x1="17" y1="10" x2="17" y2="14" stroke={color} strokeWidth="1" />
    <line x1="6" y1="17" x2="6" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10" y1="17" x2="10" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="14" y1="17" x2="14" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="18" y1="17" x2="18" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const MotherboardIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="1.5" stroke={color} strokeWidth="1.5" />
    <rect x="5" y="5" width="6" height="6" rx="0.5" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.15" />
    <rect x="14" y="5" width="5" height="3" rx="0.5" stroke={color} strokeWidth="1" />
    <rect x="14" y="9" width="5" height="3" rx="0.5" stroke={color} strokeWidth="1" />
    <rect x="5" y="14" width="14" height="2" rx="0.5" stroke={color} strokeWidth="1" />
    <rect x="5" y="17" width="14" height="2" rx="0.5" stroke={color} strokeWidth="1" />
    <circle cx="15" cy="7" r="0.8" fill={color} />
    <line x1="11" y1="8" x2="14" y2="8" stroke={color} strokeWidth="1" />
    <line x1="8" y1="11" x2="8" y2="14" stroke={color} strokeWidth="1" />
  </svg>
)

export const RAMIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth="1.5" />
    <rect x="10" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth="1.5" />
    <rect x="16" y="4" width="4" height="16" rx="1" stroke={color} strokeWidth="1.5" />
    <line x1="5.5" y1="7" x2="5.5" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="7" y1="7" x2="7" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="11.5" y1="7" x2="11.5" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="13" y1="7" x2="13" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="17.5" y1="7" x2="17.5" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="19" y1="7" x2="19" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </svg>
)

export const SSDIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="6" width="20" height="12" rx="2" stroke={color} strokeWidth="1.5" />
    <rect x="5" y="9" width="7" height="6" rx="0.5" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.15" />
    <circle cx="16" cy="12" r="2" stroke={color} strokeWidth="1.2" />
    <line x1="14" y1="9" x2="18" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="14" y1="15" x2="18" y2="15" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </svg>
)

export const HDDIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="1.5" />
    <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.2" />
    <circle cx="12" cy="12" r="1.5" fill={color} />
    <line x1="12" y1="8" x2="12" y2="9.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <rect x="18" y="10" width="2" height="4" rx="0.5" fill={color} fillOpacity="0.5" stroke={color} strokeWidth="0.5" />
    <rect x="4" y="10" width="2" height="2" rx="0.3" fill={color} fillOpacity="0.5" />
  </svg>
)

export const PSUIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="1.5" />
    <circle cx="7" cy="12" r="3" stroke={color} strokeWidth="1.2" />
    <path d="M13 9 L11.5 12.5 L13.5 12.5 L12 16" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="17" y1="9" x2="17" y2="10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="19" y1="9" x2="19" y2="10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="17" y1="13.5" x2="17" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="19" y1="13.5" x2="19" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const CaseIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5" y="2" width="14" height="20" rx="1.5" stroke={color} strokeWidth="1.5" />
    <rect x="8" y="5" width="5" height="7" rx="0.5" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.15" />
    <circle cx="14" cy="5.5" r="0.8" fill={color} />
    <circle cx="14" cy="8" r="0.8" fill={color} />
    <line x1="8" y1="16" x2="16" y2="16" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="8" y1="18.5" x2="13" y2="18.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <rect x="5" y="14" width="2" height="6" rx="0" fill={color} fillOpacity="0.3" />
  </svg>
)

export const CoolingIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
    <circle cx="12" cy="12" r="2.5" stroke={color} strokeWidth="1.2" />
    <path d="M12 3 C12 3 14 7 12 9.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M21 12 C21 12 17 14 14.5 12" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M12 21 C12 21 10 17 12 14.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M3 12 C3 12 7 10 9.5 12" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M18.36 5.64 C18.36 5.64 16 9.2 13.5 8.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M18.36 18.36 C18.36 18.36 14.8 16 15.5 13.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5.64 18.36 C5.64 18.36 8 14.8 10.5 15.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5.64 5.64 C5.64 5.64 9.2 8 8.5 10.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

export const MonitorIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="3" width="20" height="14" rx="2" stroke={color} strokeWidth="1.5" />
    <line x1="8" y1="21" x2="16" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <rect x="5" y="6" width="14" height="8" rx="0.5" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="0.8" />
  </svg>
)

export const PeripheryIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="7" width="20" height="12" rx="2" stroke={color} strokeWidth="1.5" />
    <rect x="4" y="10" width="2" height="2" rx="0.3" fill={color} />
    <rect x="7.5" y="10" width="2" height="2" rx="0.3" fill={color} />
    <rect x="11" y="10" width="2" height="2" rx="0.3" fill={color} />
    <rect x="14.5" y="10" width="2" height="2" rx="0.3" fill={color} />
    <rect x="18" y="10" width="2" height="2" rx="0.3" fill={color} />
    <rect x="4" y="14" width="2" height="2" rx="0.3" fill={color} />
    <rect x="7.5" y="14" width="2" height="2" rx="0.3" fill={color} />
    <rect x="11" y="14" width="5" height="2" rx="0.3" fill={color} />
    <rect x="17" y="14" width="3" height="2" rx="0.3" fill={color} />
    <line x1="8" y1="5" x2="16" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="5" x2="12" y2="7" stroke={color} strokeWidth="1.5" />
  </svg>
)

export const OtherIcon: React.FC<IconProps> = ({ size = 24, color = defaultColor, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.1" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke={color} strokeWidth="1.2" />
    <line x1="12" y1="22.08" x2="12" y2="12" stroke={color} strokeWidth="1.2" />
  </svg>
)

export type CategoryName =
  | 'Процессор'
  | 'Видеокарта'
  | 'Материнская плата'
  | 'Оперативная память'
  | 'SSD'
  | 'HDD'
  | 'Блок питания'
  | 'Корпус'
  | 'Охлаждение'
  | 'Монитор'
  | 'Периферия'
  | 'Другое'

export const CATEGORIES: CategoryName[] = [
  'Процессор',
  'Видеокарта',
  'Материнская плата',
  'Оперативная память',
  'SSD',
  'HDD',
  'Блок питания',
  'Корпус',
  'Охлаждение',
  'Монитор',
  'Периферия',
  'Другое',
]
