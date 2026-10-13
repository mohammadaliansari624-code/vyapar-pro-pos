export type Role = 'user' | 'admin'
export type AccountStatus = 'pending' | 'approved' | 'blocked'

export type User = { id: number; name: string; email: string; role: Role; status: AccountStatus }
export type AdminUser = User & { created_at: string }
export type Product = { id: number; code: string; name: string; price: string; stock: string; unit: string }
export type InvoiceItem = { product_id: number | null; product_name: string; unit: string; quantity: string; unit_price: string; line_total: string }
export type Invoice = {
  id: number; invoice_number: string; customer_name: string; customer_phone: string
  subtotal: string; discount: string; total: string; payment_method: string; created_at: string
  items: InvoiceItem[]
}
export type ShopSettings = { name: string; address: string; phone: string; receipt_width: string; receipt_font_size: number }
export type Summary = { today_revenue: string; last_7_days_revenue: string; lifetime_revenue: string; invoice_count: number }

export const PAYMENT_METHODS = ['Cash', 'UPI/QR', 'Card', 'Credit (Khata)'] as const
export const UNITS = ['Piece', 'kg', 'g', 'Litre', 'ml'] as const
export const RECEIPT_WIDTHS = ['58mm', '75mm', '80mm', 'A4'] as const
