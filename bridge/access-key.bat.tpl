@echo off
chcp 65001 >nul
title JARVIS - Claude Code connecte a OpenRouter
echo ================================================================
echo    JARVIS x Claude Code  -  acces via ce site web + OpenRouter
echo ================================================================
set "ANTHROPIC_BASE_URL=__BASE__/api/proxy"
set "ANTHROPIC_AUTH_TOKEN=__TOKEN__"
set "ANTHROPIC_API_KEY=__TOKEN__"
set "ANTHROPIC_MODEL=__MODEL__"
set "JARVIS_KEY=__KEY__"
set "JARVIS_MODEL=__MODEL__"
echo  Modele : __MODEL__
echo  Relais : __BASE__/api/proxy
echo.
echo [i] Le pont local (JARVIS Bridge) doit tourner pour cette liaison.
echo.
claude %*
if errorlevel 1 (
  echo.
  echo [!] La commande claude a echoue. Verifiez que Claude Code CLI est installe :
  echo     npm install -g @anthropic-ai/claude-code
)
pause >nul
