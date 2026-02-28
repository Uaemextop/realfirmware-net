@echo off & setlocal enabledelayedexpansion & mode 60,20 & color 9F

echo/REALFIRMWARE.NET & echo/ & mode con cols=77 lines=30

set "_usuario_=root" & set "_senha_=adminHW"
set "_cmd_=telnet.exe 192.168.100.1"

>"%temp%\_temp_file_4vbs_.vbs"^
    (
     echo/ Set WshShell = WScript.CreateObject^("WScript.Shell"^)
     echo/ Set objShell = WScript.CreateObject^("WScript.Shell"^)
     echo/ StrPwd  = "!_senha_!"
     echo/ StrUser = "!_usuario_!"
     echo/ for i=1 To Len^(StrUser^)
     echo/     x = Mid^(StrUser,i,1^)
     echo/     WshShell.SendKeys x
     echo/     Wscript.Sleep 250
     echo/ Next
     echo/ Wscript.Sleep 500
     echo/ WshShell.SendKeys "({ENTER})"
     echo/ for j=1 To Len^(StrPwd^)
     echo/     x = Mid^(StrPwd,j,1^)
     echo/     WshShell.SendKeys x
     echo/     Wscript.Sleep 200
     echo/ Next 
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "({ENTER})"
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "1"
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "({ENTER})"
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "su"
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "({ENTER})"
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "shell"
  	 echo/ Wscript.Sleep 200
	 echo/ WshShell.SendKeys "({ENTER})"
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "sudo restorehwmode.sh"
	 echo/ Wscript.Sleep 4500
	 echo/ WshShell.SendKeys "({ENTER})"
	 echo/ Wscript.Sleep 4500
	 echo/ WshShell.SendKeys "EquipMode.sh off"
	 echo/ Wscript.Sleep 4500
	 echo/ WshShell.SendKeys "({ENTER})"
	 echo/ Wscript.Sleep 4500
     echo/ WshShell.SendKeys "reboot"
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "({ENTER})"
     echo/ Wscript.Sleep 200
     echo/ WshShell.SendKeys "({ENTER})"
     ) 

set "_temp_vbs=%temp%\_temp_file_4vbs_.vbs" &  start "" /b !_cmd_!
@"%Windir%\System32\cScript.exe" //nologo "!_temp_vbs!" <nul & del /q /f "!_temp_vbs!" & goto :eof
