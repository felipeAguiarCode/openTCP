@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Este jogo precisa do Node.js 20 ou mais recente instalado.
  echo Veja o arquivo LEIA-ME.txt para instrucoes. Nada sera baixado automaticamente.
  echo.
  pause
  exit /b 1
)
cd /d "%~dp0"
node runner\server.mjs %*
