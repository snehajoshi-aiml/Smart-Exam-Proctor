@echo off
echo ====================================
echo  YOLOv8 Detection Microservice
echo ====================================
echo.
echo Installing dependencies...
"C:\Users\ksubh\AppData\Local\Programs\Python\Python311\python.exe" -m pip install -r requirements.txt
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8001
pause
