@echo off
echo 🌊 DiagramFlow - Run
echo ================================
echo.

if not exist "venv" (
    echo ❌ Virtual environment not found.
    echo    Please run 'setup.bat' first.
    pause
    exit /b 1
)

echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo 🚀 Starting DiagramFlow v0.3.0...
echo    Open http://localhost:5000 in your browser
echo.

python backend/app.py

pause
