@echo off
zte_telnet.exe  -l licnsefile  open -i 192.168.1.1 -u root -pw admin -p 80 >user.txt
user.txt
