/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * Tela exibida quando a instalação NÃO está autorizada (pendente, bloqueada
 * ou sem nenhuma verificação válida). Nenhum detalhe técnico é exibido.
 * Nenhum dado local é apagado: o sistema apenas não permite a entrada.
 */
import { ShieldAlert, WifiOff } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import coaHero from "@/assets/coa-hero.jpg";

interface Props {
  message: string;
  verificando?: boolean;
  online?: boolean;
}

export function InstallationGate({ message, verificando = false, online = true }: Props) {
  return (
    <div
      className="relative min-h-screen w-full bg-background bg-center bg-no-repeat bg-cover flex items-center justify-center p-4"
      style={{ backgroundImage: `url(${coaHero})` }}
    >
      <div className="absolute inset-0 bg-background/60" aria-hidden="true" />
      <Card className="relative w-full max-w-md shadow-lg backdrop-blur-sm bg-card/90">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldAlert className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl tracking-wide">MONIT.CAMPO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {verificando ? (
            <>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
              <p className="text-sm text-muted-foreground">
                Verificando a autorização desta instalação…
              </p>
            </>
          ) : (
            <p className="text-sm text-foreground">{message}</p>
          )}
          {!online && !verificando && (
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <WifiOff className="size-3.5 shrink-0" />
              Sem comunicação neste momento.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Desenvolvido por Rafael Regiolli de Souza</p>
        </CardContent>
      </Card>
    </div>
  );
}
