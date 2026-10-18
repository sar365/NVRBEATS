@echo off
title NVRBEATS - Build
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\build-windows.ps1"
echo.
pause
