/**
 * Shown when a browser refuses both ways of copying (see lib/copy.ts).
 *
 * "Select the text and copy it by hand" is no help when the text is not on the
 * page, which was the case for "Copy all fix prompts". So this puts the text on
 * the page, already selected: one key press finishes the job.
 */
import { useEffect, useId, useRef } from 'react'

export function ManualCopy({ text }: { text: string }) {
  const box = useRef<HTMLTextAreaElement>(null)
  // Several problem cards can each show one of these, so each needs its own id.
  const id = useId()

  useEffect(() => {
    box.current?.focus()
    box.current?.select()
  }, [text])

  return (
    <div className="mt-3 rounded-md border border-border bg-muted p-3">
      <label htmlFor={id} className="block font-medium text-foreground">
        This browser blocked copying. The text is selected below: press Cmd+C, or Ctrl+C on Windows.
      </label>
      <textarea
        id={id}
        ref={box}
        readOnly
        value={text}
        rows={8}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-2 w-full rounded-md border border-border bg-background p-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring"
      />
    </div>
  )
}
