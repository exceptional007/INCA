import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground rounded-full hover:opacity-95 shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground rounded-full hover:opacity-95 shadow-none",
        outline:
          "border border-input bg-background rounded-full hover:bg-secondary hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground rounded-full hover:bg-muted",
        ghost: "rounded-lg hover:bg-accent hover:text-accent-foreground",
        link: "text-primary hover:underline underline-offset-4 bg-transparent",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-sm px-4 py-1.5 text-xs",
        lg: "h-12 rounded-full px-8 py-3 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
