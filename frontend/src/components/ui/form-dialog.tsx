import React from 'react'
import { useForm, type UseFormReturn, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { type z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { cn } from '@/lib/utils'

interface FormDialogProps<TSchema extends z.ZodTypeAny> {
  /** Controls dialog open state */
  open: boolean
  /** Called when dialog should close */
  onOpenChange: (open: boolean) => void
  /** Dialog title */
  title: string
  /** Optional description below the title */
  description?: string
  /** Zod schema for form validation */
  schema: TSchema
  /** Default values for form fields */
  defaultValues: z.infer<TSchema>
  /** Called with validated form data on submit */
  onSubmit: (values: z.infer<TSchema>) => Promise<void>
  /** Render prop receiving the form instance */
  children: (form: UseFormReturn<any>) => React.ReactNode
  /** Override submit button label */
  submitLabel?: string
  /** Override cancel button label */
  cancelLabel?: string
  /** Optional custom class for dialog sizing/styling */
  className?: string
}

/**
 * Reusable FormDialog — wraps a shadcn Dialog with react-hook-form + zod.
 */
export function FormDialog<TSchema extends z.ZodTypeAny>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  className,
}: FormDialogProps<TSchema>) {
  const form = useForm<any>({
    resolver: zodResolver(schema as any),
    defaultValues,
  })

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)

  // Reset form state whenever dialog opens with fresh defaultValues
  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues)
      setApiError(null)
    }
  }, [open])

  const handleSubmit: SubmitHandler<z.infer<TSchema>> = async (values) => {
    setIsSubmitting(true)
    setApiError(null)
    try {
      await onSubmit(values)
      onOpenChange(false)
      form.reset(defaultValues)
    } catch (err: any) {
      setApiError(
        err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0", className)}>
        <DialogHeader className="p-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {children(form as any)}

              {/* API-level error message */}
              {apiError && (
                <p className="text-sm font-medium text-destructive rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2">
                  {apiError}
                </p>
              )}
            </div>

            <DialogFooter className="p-4 px-6 border-t border-border/50 bg-muted/20 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

