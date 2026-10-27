/**
 * Entrada exclusiva do empacotamento Electron (desktop offline).
 * Monta exatamente a mesma aplicação da rota "/" — nenhuma regra de
 * negócio, cálculo ou armazenamento é alterado aqui.
 */
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource-variable/jetbrains-mono";
import "@/styles.css";
import { installUnitStorageScope } from "@/lib/units";

installUnitStorageScope();

const Index = lazy(() => import("@/pages/Index"));

function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Carregando MONIT.CAMPO...
      </p>
      <p className="fixed bottom-2 right-3 text-[10px] text-muted-foreground/70">
        Desenvolvido por Rafael Regiolli
      </p>
    </div>
  );
}

document.title = "MONIT.CAMPO";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <Sonner />
      <Suspense fallback={<Loading />}>
        <Index />
      </Suspense>
    </TooltipProvider>
  </StrictMode>
);