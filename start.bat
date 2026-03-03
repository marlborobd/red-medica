@echo off
echo ============================================
echo   Asistenta Medicala la Domiciliu
echo ============================================
echo.
echo Pornesc serverul Backend (port 5000)...
start "Backend - API Server" cmd /k "cd /d %~dp0backend && node server.js"
timeout /t 2 /nobreak > nul

echo Pornesc serverul Frontend (port 3000)...
start "Frontend - React App" cmd /k "cd /d %~dp0frontend && npx react-scripts start"

echo.
echo Aplicatia porneste...
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Login implicit: admin@asistenta.ro / Admin123!
echo.
timeout /t 5 /nobreak > nul
start http://localhost:3000
