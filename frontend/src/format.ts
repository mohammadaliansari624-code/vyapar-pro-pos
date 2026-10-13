import type { Product } from './types'

export const money = (v: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(v || 0))

// "5.000" -> "5", "2.500" -> "2.5"
export const qty = (v: string | number) => String(Number(v))

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

// The backend has no low-stock setting yet, so one shared limit is used here.
export const LOW_STOCK_LIMIT = 5

export type StockState = 'out' | 'low' | 'ok'
export const stockState = (p: Product): StockState => {
  const stock = Number(p.stock)
  return stock <= 0 ? 'out' : stock <= LOW_STOCK_LIMIT ? 'low' : 'ok'
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000
export const round2 = (n: number) => Math.round(n * 100) / 100
