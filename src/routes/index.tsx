import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { installUnitStorageScope } from "@/lib/units";

installUnitStorageScope();

const Index = lazy(() => import("@/pages/Index"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MONIT.CAMPO — Controle de Manutenção Agrícola" },
      {
        name: "description",
        content:
          "Sistema de controle de manutenção e logística de colhedoras, tratores, transbordos e caminhões.",
      },
      { property: "og:title", content: "MONIT.CAMPO — Controle de Manutenção Agrícola" },
      {
        property: "og:description",
        content: "Sistema de controle de manutenção e logística de colhedoras, tratores, transbordos e caminhões.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

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

function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Loading />;

  return (
    <TooltipProvider>
      <Sonner />
      <Suspense fallback={<Loading />}>
        <Index />
      </Suspense>
    </TooltipProvider>
  );
}
