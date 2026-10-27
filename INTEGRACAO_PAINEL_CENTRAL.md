# Integração do Painel Central no MONIT.CAMPO

## O que foi adicionado
- Ícone discreto (escudo) no canto superior direito da tela de login
- Card Acesso administrativo na aba Configurações
- Ambos abrem a mesma janela do Electron apontando para https://monit-field-guard.lovable.app

## Arquivos alterados
- electron/main.cjs
- electron/preload.cjs
- src/components/LoginScreen.tsx
- src/components/SettingsView.tsx

## Como usar
1. npm install
2. npm run build:electron
3. npm run electron (ou npm run dist no Windows)

Clique no ícone de escudo na tela de login ou no botão em Configurações.
O Painel Central abre em janela separada (online). Login e senha são os do painel original.
