import { useId, useState } from 'react'
import { Check, CircleHelp, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export interface QuizOption {
  text: string
  correct: boolean
}

export interface QuizQuestion {
  prompt: string
  options: QuizOption[]
  /** The answer key: why the right answer is right. */
  explanation?: string
}

/**
 * Practice questions with an answer key, embedded in lesson content.
 *
 * Every module closes with a set of these. Answers are checked in the browser
 * and nothing is recorded: this is self-assessment, not an exam, so a learner
 * can get it wrong without it counting against them. The graded assessment on
 * this platform is the certification challenge, which is a separate thing.
 */
export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const baseId = useId()
  const [chosen, setChosen] = useState<Record<number, number>>({})
  const [checked, setChecked] = useState(false)

  if (questions.length === 0) return null

  const answered = Object.keys(chosen).length
  const score = questions.reduce(
    (total, question, index) =>
      question.options[chosen[index] ?? -1]?.correct ? total + 1 : total,
    0,
  )

  function reset() {
    setChosen({})
    setChecked(false)
  }

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className="my-8 rounded-xl border border-ink-200 bg-ink-50 p-5 sm:p-6"
    >
      <div className="flex items-center gap-2.5">
        <CircleHelp className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
        <h3 id={`${baseId}-heading`} className="text-base font-bold text-ink-900">
          Check your understanding
        </h3>
        <span className="ml-auto text-xs font-medium text-ink-500">
          {questions.length} question{questions.length === 1 ? '' : 's'}
        </span>
      </div>

      <ol className="mt-5 space-y-6">
        {questions.map((question, questionIndex) => {
          const groupName = `${baseId}-q${questionIndex}`
          const selected = chosen[questionIndex]
          const isCorrect = question.options[selected ?? -1]?.correct ?? false

          return (
            <li key={groupName}>
              <fieldset>
                <legend className="text-sm font-semibold text-ink-900">
                  {questionIndex + 1}. {question.prompt}
                </legend>

                <div className="mt-3 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const optionId = `${groupName}-o${optionIndex}`
                    const isChosen = selected === optionIndex
                    // After checking, mark the right answer whether or not it
                    // was picked -- a learner who guessed wrong still needs to
                    // see which one was right.
                    const showRight = checked && option.correct
                    const showWrong = checked && isChosen && !option.correct

                    return (
                      <label
                        key={optionId}
                        htmlFor={optionId}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-3.5 py-2.5 text-sm transition',
                          showRight
                            ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900'
                            : showWrong
                              ? 'border-rose-300 bg-rose-50/70 text-rose-900'
                              : isChosen
                                ? 'border-brand-300 bg-brand-50/60 text-ink-900'
                                : 'border-ink-200 text-ink-700 hover:border-brand-200 hover:bg-brand-50/30',
                        )}
                      >
                        <input
                          type="radio"
                          id={optionId}
                          name={groupName}
                          checked={isChosen}
                          onChange={() => {
                            setChosen((current) => ({
                              ...current,
                              [questionIndex]: optionIndex,
                            }))
                            setChecked(false)
                          }}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                        />
                        <span className="flex-1">{option.text}</span>
                        {showRight && (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        )}
                        {showWrong && (
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                        )}
                      </label>
                    )
                  })}
                </div>

                {checked && question.explanation && (
                  <p
                    className={cn(
                      'mt-3 rounded-lg border-l-4 py-2 pl-3.5 pr-3 text-sm leading-relaxed',
                      isCorrect
                        ? 'border-emerald-400 bg-emerald-50/60 text-emerald-900'
                        : 'border-amber-400 bg-amber-50/60 text-amber-900',
                    )}
                  >
                    <span className="font-semibold">Answer. </span>
                    {question.explanation}
                  </p>
                )}
              </fieldset>
            </li>
          )
        })}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink-200 pt-5">
        <Button
          size="sm"
          disabled={answered === 0}
          onClick={() => setChecked(true)}
        >
          Check answers
        </Button>
        {checked && (
          <>
            <p className="text-sm font-semibold text-ink-900" role="status">
              {score} of {questions.length} correct
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={reset}
              leadingIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
            >
              Try again
            </Button>
          </>
        )}
        {!checked && answered > 0 && answered < questions.length && (
          <p className="text-xs text-ink-500">
            {questions.length - answered} left to answer
          </p>
        )}
      </div>
    </section>
  )
}
