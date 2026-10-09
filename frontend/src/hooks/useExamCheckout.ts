import { useCallback, useState } from 'react'

import { useSite } from '@/hooks/useSite'
import { openRazorpayCheckout, toMinorUnits } from '@/lib/razorpay'
import type { ExamCheckout } from '@/types/api'

/**
 * What the browser knows about a payment. Never authoritative.
 *
 * `submitted` means the payer got through the provider's form, not that the
 * money has landed -- only the signed webhook decides that -- so every label
 * driven by this state is worded as "being confirmed" rather than "paid".
 */
export type CheckoutState = 'idle' | 'opening' | 'abandoned' | 'submitted' | 'unavailable'

/**
 * Opens the provider's checkout for an exam fee.
 *
 * Shared by every surface that can take payment for an exam -- the scheduling
 * confirmation, a passed test's result screen, a deal card, the dashboard -- so
 * they all treat the provider's response the same way.
 */
export function useExamCheckout() {
  const { brand } = useSite()
  const [state, setState] = useState<CheckoutState>('idle')

  const open = useCallback(
    async (checkout: ExamCheckout) => {
      if (!checkout.public_key || !checkout.order_id) {
        // A provider that redirects instead of opening a modal: send them there.
        if (checkout.checkout_url) {
          window.location.assign(checkout.checkout_url)
          return
        }
        setState('unavailable')
        return
      }
      setState('opening')
      const opened = await openRazorpayCheckout({
        publicKey: checkout.public_key,
        orderId: checkout.order_id,
        amountMinor: toMinorUnits(checkout.amount, checkout.currency),
        currency: checkout.currency,
        name: brand.brandName,
        description: checkout.description,
        prefill: {
          name: checkout.prefill_name,
          email: checkout.prefill_email,
          contact: checkout.prefill_contact,
        },
        onDismiss: () => setState('abandoned'),
        onComplete: () => setState('submitted'),
      })
      if (!opened) setState('unavailable')
    },
    [brand.brandName],
  )

  return { state, setState, open }
}
