@echo off
chcp 65001 >NUL
git pull
setlocal enabledelayedexpansion

REM Enter script directory
pushd %~dp0

set "VENV_DIR=.venv"

if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo [INFO] Creating Python virtual environment...
    python -m venv "%VENV_DIR%"
)

call "%VENV_DIR%\Scripts\activate.bat"

echo [INFO] Upgrading pip...
python -m pip install --upgrade pip >NUL

echo [INFO] Installing dependencies...
pip install -r requirements.txt

if not exist ".env" (
    echo [WARN] .env file not found, please copy example.env and configure database settings
)

echo [INFO] Starting Uvicorn server on port 5085...
uvicorn app.main:app --host 0.0.0.0 --port 5085 --reload

popd
endlocal



