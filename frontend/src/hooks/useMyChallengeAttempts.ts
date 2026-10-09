import { useQuery } from '@tanstack/react-query'

import { getMyChallengeAttempts } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryClient'
import type { ChallengeAttemptSummary } from '@/types/api'

/**
 * Every discount test the signed-in learner has sat.
 *
 * Disabled while signed out: an attempt belongs to an account or to the email
 * address that sat it, so there is nothing to look up for a visitor we cannot
 * name. Surfaces that use this therefore degrade to their signed-out form
 * rather than showing an empty result.
 */
export function useMyChallengeAttempts() {
  const { isAuthenticated } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.myChallengeAttempts,
    queryFn: getMyChallengeAttempts,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
  return { attempts: query.data ?? [], ...query }
}

/** The most recent sitting for one certification, if there is one. */
export function latestAttemptFor(
  attempts: ChallengeAttemptSummary[],
  certificationId: string | null | undefined,
): ChallengeAttemptSummary | null {
  if (!certificationId) return null
  // The API already returns newest first.
  return attempts.find((attempt) => attempt.certification_id === certificationId) ?? null
}

/**
 * True once the cooldown has passed, or when the campaign sets none.
 *
 * The server sends the unlock date rather than the rule, so this never has to
 * add days up and can never disagree with the endpoint that enforces it.
 */
export function canRetakeNow(retakeAvailableOn: string | null): boolean {
  return retakeAvailableOn === null
}
