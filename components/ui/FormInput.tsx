import * as React from "react"
import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "./Input"
import { Label } from "./Label"

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, hint, className, id, name, required, style, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? name ?? generatedId
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <Label
            htmlFor={inputId}
            className={cn(
              "text-sm",
              error ? "text-destructive" : "text-foreground"
            )}
          >
            {label}
            {required ? <span className="ml-1 text-destructive">*</span> : null}
          </Label>
        ) : null}
        <Input
          id={inputId}
          name={name}
          ref={ref}
          required={required}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={describedBy}
          readOnly={error ? true : props.readOnly}
          className={cn(
            error
              ? "border-destructive placeholder:text-red-500/80 focus-visible:border-destructive focus-visible:ring-destructive/40 read-only:cursor-not-allowed"
              : undefined,
            className
          )}
          style={
            error
              ? {
                  backgroundColor: "#fde047",
                  color: "#b91c1c",
                  borderColor: "#dc2626",
                  boxShadow: "0 0 0 2px rgba(220, 38, 38, 0.28)",
                  caretColor: "#b91c1c",
                  ...style,
                }
              : style
          }
          {...props}
        />
        {hint && !error ? (
          <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p
            id={`${inputId}-error`}
            className="inline-flex items-start gap-1.5 text-xs font-medium text-destructive"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    )
  }
)

FormInput.displayName = "FormInput"
