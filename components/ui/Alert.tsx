import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default:
          "border-[var(--alert-default-border)] bg-[var(--alert-default-bg)] text-[var(--alert-default-text)] [&>svg]:text-[var(--alert-default-icon)]",
        info:
          "border-[var(--alert-info-border)] bg-[var(--alert-info-bg)] text-[var(--alert-info-text)] [&>svg]:text-[var(--alert-info-icon)]",
        success:
          "border-[var(--alert-success-border)] bg-[var(--alert-success-bg)] text-[var(--alert-success-text)] [&>svg]:text-[var(--alert-success-icon)]",
        warning:
          "border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)] [&>svg]:text-[var(--alert-warning-icon)]",
        destructive:
          "border-[var(--alert-destructive-border)] bg-[var(--alert-destructive-bg)] text-[var(--alert-destructive-text)] [&>svg]:text-[var(--alert-destructive-icon)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
