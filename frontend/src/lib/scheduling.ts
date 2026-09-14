/**
 * Path to the exam scheduling form.
 *
 * Passing a certification id pre-selects it, which is what every entry point on
 * a certification page does -- nobody should have to pick the exam they were
 * already reading about.
 */
export function scheduleExamPath(certificationId?: string | null): string {
  return certificationId
    ? `/schedule-exam?certification=${encodeURIComponent(certificationId)}`
    : '/schedule-exam'
}
