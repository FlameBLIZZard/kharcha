@echo off
rem Pull the latest Kharcha, build the APK and send it to Aditya's Telegram (token + chat id in %USERPROFILE%\.telegram-bot.env).
setlocal
cd /d "%~dp0"

git pull --ff-only || goto :fail
call "%~dp0build-apk.bat" || goto :fail

for /f "usebackq tokens=1,* delims==" %%A in ("%USERPROFILE%\.telegram-bot.env") do set "%%A=%%B"
if not defined TELEGRAM_BOT_TOKEN goto :notg
if not defined TELEGRAM_CHAT_ID goto :notg
for /f %%H in ('git rev-parse --short HEAD') do set "REV=%%H"

curl.exe -s -o "%TEMP%\kharcha-tg.json" -w "%%{http_code}" -F chat_id=%TELEGRAM_CHAT_ID% -F "caption=Kharcha APK (%REV%)" -F "document=@%CD%\Kharcha.apk;filename=Kharcha.apk;type=application/vnd.android.package-archive" "https://api.telegram.org/bot%TELEGRAM_BOT_TOKEN%/sendDocument" > "%TEMP%\kharcha-tg.code"
set /p CODE=<"%TEMP%\kharcha-tg.code"
if not "%CODE%"=="200" (echo Telegram send failed, HTTP %CODE% & goto :fail)
echo SENT to Telegram: Kharcha.apk (%REV%)
exit /b 0

:notg
echo Built, but %USERPROFILE%\.telegram-bot.env needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to send it.
exit /b 1

:fail
echo.
echo BUILD-AND-SEND FAILED
exit /b 1
