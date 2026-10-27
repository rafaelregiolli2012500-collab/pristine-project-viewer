# MONIT.CAMPO

Sistema de controle de manutenção e logística agrícola (colhedoras, tratores, transbordos e caminhões).
Os dados são armazenados localmente no navegador/aplicativo (localStorage), com backup e restauração integrais.

## Arquitetura de build

Existem dois modos independentes, sem mistura de configuração:

| Modo | Configuração | Entrada | Saída |
| --- | --- | --- | --- |
| Web (TanStack Start + SSR) | `vite.config.ts` | `src/routes` | `.output/` |
| Desktop (Electron) | `vite.electron.config.ts` | `desktop/index.html` → `src/desktop/main.tsx` | `dist-electron/` |

O build desktop compila a **aplicação React principal de `src`** (raiz = raiz do projeto,
`base: "./"`, alias `@`, React + Tailwind). A pasta `electron/` contém apenas o processo
principal e o preload — nunca o código do frontend.

## Comandos

```sh
npm install
npm run dev            # desenvolvimento web (TanStack Start)
npm run build          # build web
npm run icons          # gera build/icon.ico + build/icon.png a partir de public/icon.png
npm run electron:build # compila o frontend para dist-electron/
npm run electron       # compila e abre o app desktop
npm run dist           # instalador NSIS + portátil (Windows)
npm run build:exe      # idêntico ao dist
```

`npm run dist` produz em `release/`:

- `MONIT.CAMPO-Setup.exe` — instalador NSIS (pasta escolhível, atalhos, desinstalador)
- `MONIT.CAMPO.exe` — versão portátil
- `win-unpacked/MONIT.CAMPO.exe` — executável descompactado

> O passo final de gravação do ícone no `.exe` exige Windows (ou Wine). Rode `npm run dist`
> em uma máquina Windows 10/11 para obter o instalador completo.

## Detalhes

- `appId`: `com.monit.campo` · `productName`: **MONIT.CAMPO** · Electron 33 · Node LTS.
- Ícone oficial gerado automaticamente (`scripts/make-icons.mjs`, 16→256 px) e aplicado ao
  executável, instalador, desinstalador, cabeçalho do instalador, janela, barra de tarefas e atalhos.
- Janela sem moldura, com barra personalizada em React (arraste, minimizar, maximizar, fechar via IPC).
- 100% offline: HTML, JS, CSS, fontes, imagens e ícones empacotados no ASAR e servidos pelo
  protocolo privilegiado `app://` (módulos ES não carregam sob `file://`).
- Segurança: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP restrita,
  preload mínimo com canais IPC nominais e links externos abertos no navegador padrão.
