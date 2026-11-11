@echo off
title RxR VLN Multilingual Decision Agent
cd /d "%~dp0"
echo =================================================================
echo   Starting RxR Multilingual VLN Decision Agent Simulator...
echo   Access URL: http://localhost:8080/ (or http://127.0.0.1:8080/)
echo =================================================================
timeout /t 1 >nul
start "" "http://localhost:8080/"
python run_simulator.py --port 8080
pause
