import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-xl border border-[var(--textarea-border)] bg-[var(--textarea-bg)] px-3 py-3 text-base text-[var(--textarea-text)] transition-colors outline-none placeholder:text-[var(--textarea-placeholder)] focus-visible:border-[var(--textarea-ring-color)] focus-visible:ring-[3px] focus-visible:ring-[var(--textarea-ring-color)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
