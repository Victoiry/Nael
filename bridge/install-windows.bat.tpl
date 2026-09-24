@echo off
chcp 65001 >nul
title JARVIS - Installation du pont local
color 0A
setlocal
set "JHOME=%USERPROFILE%\.jarvis"
if not exist "%JHOME%" mkdir "%JHOME%"
echo ================================================================
echo                     J A R V I S   S E T U P
echo ================================================================
echo.
echo  Base URL : __BASE__
echo  Modele   : __MODEL__
echo.
echo [1/5] Verification de Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo       Node.js absent -^> installation automatique...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements >nul 2>nul
  where node >nul 2>nul
  if errorlevel 1 (
    echo       Telechargement du MSI Node.js LTS...
    powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi -OutFile $env:TEMP\node.msi; Start-Process msiexec.exe -ArgumentList '/i',$env:TEMP\node.msi,'/qn' -Wait"
    set "PATH=%PATH%;C:\Program Files\nodejs"
  )
) else (
  for /f "delims=" %%v in ('node -v') do echo       Node %%v detecte.
)

echo.
echo [2/5] Installation de Claude Code CLI...
call npm install -g @anthropic-ai/claude-code >nul 2>nul
if errorlevel 1 echo       [!] npm install a echoue - reessayez plus tard.

echo.
echo [3/5] Liaison du CLI avec OpenRouter (mode gratuit)...
set "ANTHROPIC_BASE_URL=https://openrouter.ai/api"
set "ANTHROPIC_AUTH_TOKEN=__KEY__"
set "ANTHROPIC_API_KEY=__KEY__"
set "ANTHROPIC_MODEL=__MODEL__"
setx ANTHROPIC_BASE_URL "https://openrouter.ai/api" >nul
setx ANTHROPIC_AUTH_TOKEN "__KEY__" >nul
setx ANTHROPIC_API_KEY "__KEY__" >nul
setx ANTHROPIC_MODEL "__MODEL__" >nul
echo       OK - Claude CLI utilise maintenant __MODEL__ via OpenRouter.

echo.
echo [4/5] Telechargement du pont JARVIS (controle du PC)...
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri '__BASE__/api/bridge/runner.js' -OutFile '%JHOME%\bridge.js'"
powershell -NoProfile -Command "Set-Content -Path '%JHOME%\config.json' -Value '{\"base\":\"__BASE__\",\"token\":\"__TOKEN__\",\"pair\":\"__PAIRCODE__\"}' -Encoding UTF8"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\JARVIS Bridge.lnk');$s.TargetPath='node';$s.Arguments='\"%JHOME%\bridge.js\"';$s.WorkingDirectory='%JHOME%';$s.Save()"

echo.
echo [5/5] Liaison avec le site web JARVIS...
start "" node "%JHOME%\bridge.js"
timeout /t 4 >nul
start "" "__BASE__/?pair=__PAIRCODE__"

echo.
echo ================================================================
echo   CLE DE VERIFICATION - copiez ce numero dans le site JARVIS
echo ================================================================
echo.
echo              >>>>>>   __PAIRCODE__   <<<<<<
echo.
echo   Il se teste tout seul : le site verifie la liaison aupres
echo   du pont local toutes les 2 secondes.
echo ================================================================
echo.
echo   Appuyez sur une touche pour fermer cette fenetre.
pause >nul
