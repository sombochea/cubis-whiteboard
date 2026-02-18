"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      gap={8}
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-500" />,
        info: <InfoIcon className="size-4 text-blue-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <OctagonXIcon className="size-4 text-red-500" />,
        loading: <Loader2Icon className="size-4 animate-spin text-[var(--muted-foreground)]" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-full rounded-xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-lg px-4 py-3 shadow-lg shadow-black/5",
          title: "text-sm font-medium text-[var(--foreground)]",
          description: "text-xs text-[var(--muted-foreground)] mt-0.5",
          actionButton:
            "ml-auto shrink-0 rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[11px] font-semibold text-white",
          cancelButton:
            "ml-auto shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)]",
          closeButton:
            "absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
