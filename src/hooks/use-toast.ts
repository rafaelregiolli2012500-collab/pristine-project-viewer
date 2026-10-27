/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { toast as sonnerToast } from "sonner";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
};

export function toast({ title, description, variant }: ToastInput) {
  const message = (title ?? description ?? "") as string;
  const opts = title && description ? { description } : undefined;
  if (variant === "destructive") return sonnerToast.error(message, opts);
  return sonnerToast(message, opts);
}

export function useToast() {
  return { toast, dismiss: sonnerToast.dismiss, toasts: [] as unknown[] };
}
