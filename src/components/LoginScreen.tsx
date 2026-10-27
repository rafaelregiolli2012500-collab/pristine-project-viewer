/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * Tela de entrada: somente SENHA. Nenhum usuário, e-mail ou matrícula.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Wrench, Shield } from 'lucide-react';
import coaHero from '@/assets/coa-hero.jpg';

import type { LoginResult } from '@/hooks/useAuth';

interface Props {
  onLogin: (password: string) => Promise<LoginResult>;
  aviso?: string | null;
}

declare global {
  interface Window {
    monitCampo?: {
      isDesktop?: boolean;
      openAdminPanel?: () => void;
    };
  }
}

export function LoginScreen({ onLogin, aviso }: Props) {
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const res = await onLogin(password);
    setEnviando(false);
    if (!res.ok) {
      setErro(res.message ?? 'Senha incorreta');
      setPassword('');
    }
  };

  const openAdmin = () => {
    if (typeof window !== 'undefined' && window.monitCampo?.openAdminPanel) {
      window.monitCampo.openAdminPanel();
    }
  };

  return (
    <div
      className="relative min-h-screen w-full bg-background bg-center bg-no-repeat bg-cover flex items-center justify-center p-4"
      style={{ backgroundImage: `url(${coaHero})` }}
    >
      <div className="absolute inset-0 bg-background/55" aria-hidden="true" />

      {/* Ícone discreto — Acesso administrativo (Painel Central) */}
      <button
        type="button"
        onClick={openAdmin}
        title="Acesso administrativo"
        aria-label="Acesso administrativo"
        className="absolute top-4 right-4 z-20 p-2 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-background/40 transition-colors"
      >
        <Shield className="h-5 w-5" />
      </button>

      <Card className="relative w-full max-w-sm shadow-lg backdrop-blur-sm bg-card/90">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Wrench className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl tracking-wide">MONIT.CAMPO</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErro(null);
                }}
                placeholder="Senha"
                className="pl-10"
                autoFocus
              />
            </div>
            {(erro ?? aviso) && (
              <p className="text-sm text-destructive text-center">{erro ?? aviso}</p>
            )}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Verificando…' : 'Entrar'}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Desenvolvido por Rafael Regiolli de Souza
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
