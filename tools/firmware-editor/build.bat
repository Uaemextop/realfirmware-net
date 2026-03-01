@echo off
REM Build RealFirmware HWNP Editor as a standalone Windows .exe
REM Requires Python 3.8+ and pip

echo Installing PyInstaller...
pip install pyinstaller==6.13.0

echo.
echo Building firmware_editor.exe...
pyinstaller --onefile --windowed ^
    --name "RealFirmware-HWNP-Editor" ^
    firmware_editor.py

echo.
echo Build complete! Output: dist\RealFirmware-HWNP-Editor.exe
pause
