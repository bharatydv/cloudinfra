/**
 * Razorpay Checkout, loaded on demand.
 *
 * The script is only fetched when somebody actually reaches payment, so the
 * marketing pages do not pay for it.
 *
 * Nothing this module returns is proof of payment. Razorpay's handler fires in
 * the browser and a browser can be lied to, so the result is treated purely as
 * a UI signal; the booking is marked paid only when the signed webhook reaches
 * the API.
 */

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

interface RazorpayInstance {
  open: () => void
  on: (event: string, handler: (payload: unknown) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance
  }
}

let loader: Promise<boolean> | null = null

export function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true)
  // Collapse concurrent calls onto one script tag.
  loader ??= new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.addEventListener('load', () => resolve(Boolean(window.Razorpay)))
    script.addEventListener('error', () => {
      loader = null
      resolve(false)
    })
    if (!existing) document.body.appendChild(script)
  })
  return loader
}

export interface CheckoutOptions {
  publicKey: string
  orderId: string
  amountMinor: number
  currency: string
  name: string
  description: string
  prefill: { name: string; email: string; contact: string }
  onDismiss: () => void
  onComplete: () => void
}

/** Opens the modal. Resolves false when the script could not be loaded. */
export async function openRazorpayCheckout(options: CheckoutOptions): Promise<boolean> {
  const ready = await loadRazorpay()
  if (!ready || !window.Razorpay) return false

  const checkout = new window.Razorpay({
    key: options.publicKey,
    order_id: options.orderId,
    amount: options.amountMinor,
    currency: options.currency,
    name: options.name,
    description: options.description,
    prefill: options.prefill,
    theme: { color: '#4f46e5' },
    modal: { ondismiss: options.onDismiss },
    // Treated as "the payer got through the form", never as "we have the
    // money" -- that only comes from the webhook.
    handler: () => options.onComplete(),
  })
  checkout.on('payment.failed', () => options.onDismiss())
  checkout.open()
  return true
}

/**
 * Razorpay quotes amounts in minor units. Mirrors the backend conversion; the
 * server figure is authoritative and this only drives the modal's display.
 */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK'])

export function toMinorUnits(amount: string, currency: string): number {
  const value = Number(amount)
  if (!Number.isFinite(value)) return 0
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(value)
    : Math.round(value * 100)
}
