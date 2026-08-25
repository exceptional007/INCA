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
}

/**
 * Reusable FormDialog — wraps a shadcn Dialog with react-hook-form + zod.
 *
 * Usage:
 * ```tsx
 * <FormDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Create Department"
 *   schema={departmentSchema}
 *   defaultValues={{ name: '', code: '' }}
 *   onSubmit={async (values) => { await api.post('/academic/departments', values) }}
 * >
 *   {(form) => (
 *     <>
 *       <FormField control={form.control} name="name" render={...} />
 *       <FormField control={form.control} name="code" render={...} />
 *     </>
 *   )}
 * </FormDialog>
 * ```
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 pt-2">
            {children(form as any)}

            {/* API-level error message */}
            {apiError && (
              <p className="text-sm font-medium text-destructive rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2">
                {apiError}
              </p>
            )}

            <DialogFooter className="pt-2">
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
