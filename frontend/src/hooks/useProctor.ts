import { useEffect, useRef } from 'react'

import type { ChallengeViolationKind } from '@/types/api'

/**
 * Two events fire for a single tab switch -- `blur` and `visibilitychange` --
 * and a context menu can be followed immediately by a copy. Collapsing
 * everything inside this window means one *incident* costs one warning, which
 * is what a candidate is told and what they can reason about. Without it, a
 * single alt-tab would burn two of three warnings.
 */
const INCIDENT_WINDOW_MS = 1200

/** Shortcuts blocked outright, with no warning: nothing can be extracted with
 *  them once the paper is unselectable, so warning would only be noise. */
const SILENT_BLOCKED_KEYS = new Set(['a', 'p', 's', 'u'])

/** Shortcuts that are themselves the offence. */
const WARNED_KEYS: Record<string, ChallengeViolationKind> = {
  c: 'copy',
  x: 'cut',
  v: 'paste',
}

export interface ProctorOptions {
  /** Only watch while a paper is actually open. */
  active: boolean
  /** Called once per incident. The caller decides what a warning costs. */
  onViolation: (kind: ChallengeViolationKind) => void
}

/**
 * Watches for the two things the candidate agreed not to do: leaving the test
 * window, and copying the questions out of it.
 *
 * This is deterrence, not security. A determined cheat can disable JavaScript
 * or photograph the screen; what this catches is the casual switch to a search
 * engine, which is the behaviour the rules are actually about. The warning
 * count that matters is the server's -- this hook only reports incidents.
 */
export function useProctor({ active, onViolation }: ProctorOptions) {
  // Kept in a ref so re-rendering the page (every answer, every timer tick)
  // does not tear down and reattach every listener.
  const handler = useRef(onViolation)
  useEffect(() => {
    handler.current = onViolation
  }, [onViolation])

  const lastIncidentAt = useRef(0)

  useEffect(() => {
    if (!active) return

    const report = (kind: ChallengeViolationKind) => {
      const now = Date.now()
      if (now - lastIncidentAt.current < INCIDENT_WINDOW_MS) return
      lastIncidentAt.current = now
      handler.current(kind)
    }

    const onVisibilityChange = () => {
      if (document.hidden) report('tab_hidden')
    }
    const onWindowBlur = () => report('window_blur')
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) report('fullscreen_exit')
    }

    const blockAndWarn = (kind: ChallengeViolationKind) => (event: Event) => {
      event.preventDefault()
      report(kind)
    }
    const onCopy = blockAndWarn('copy')
    const onCut = blockAndWarn('cut')
    const onPaste = blockAndWarn('paste')
    const onContextMenu = blockAndWarn('context_menu')

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const key = event.key.toLowerCase()
      if (SILENT_BLOCKED_KEYS.has(key)) {
        event.preventDefault()
        return
      }
      const kind = WARNED_KEYS[key]
      if (kind) {
        event.preventDefault()
        report(kind)
      }
    }

    // Closing or reloading mid-paper loses the session token, and with it the
    // ability to submit -- so the browser asks first.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [active])
}
