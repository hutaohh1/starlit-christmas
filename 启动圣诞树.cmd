@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules call npm install
if not exist public\vision\hand_landmarker.task call npm run setup:vision
start "" http://localhost:5173/version-3.html
call npm run dev
pause
