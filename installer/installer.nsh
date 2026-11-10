; MONIT.CAMPO - ajustes do instalador NSIS (electron-builder)
; Pasta compartilhada do Installation ID: %ProgramData%\MONIT.CAMPO
; Um computador = um Installation ID para todos os usuarios do Windows.

!macro customInstall
  ReadEnvStr $0 "ProgramData"
  StrCmp $0 "" 0 +2
    StrCpy $0 "C:\ProgramData"
  CreateDirectory "$0\MONIT.CAMPO"
  ; Usuarios (S-1-5-32-545) podem ler e criar o ID na primeira abertura.
  nsExec::ExecToLog 'icacls "$0\MONIT.CAMPO" /grant *S-1-5-32-545:(OI)(CI)M'
  Pop $1
!macroend

!macro customUnInstall
  ; A pasta do Installation ID e mantida em atualizacoes e desinstalacoes,
  ; para que o computador continue sendo a mesma instalacao na Central.
!macroend
