@echo off
REM Open a new PowerShell window and run the server
start powershell -NoExit -Command "cd 'C:\work_of_atri\tileo'; .\venv\Scripts\Activate.ps1; python app.py"
