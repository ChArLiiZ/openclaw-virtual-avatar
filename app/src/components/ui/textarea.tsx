import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => {
  return <textarea ref={ref} className={cn('flex min-h-[120px] w-full rounded-xl border bg-input px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />
})
Textarea.displayName = 'Textarea'

export { Textarea }
