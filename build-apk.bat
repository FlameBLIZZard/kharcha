@echo off
rem One-shot local debug APK build for Kharcha. Output: Kharcha.apk next to this file.
setlocal
cd /d "%~dp0"

if not defined JAVA_HOME for /d %%D in ("C:\Program Files\Eclipse Adoptium\jdk-17*") do set "JAVA_HOME=%%~fD"
if not defined ANDROID_HOME set "ANDROID_HOME=%USERPROFILE%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%

call npm install || goto :fail
call npm test || goto :fail
call npm run build:www || goto :fail

rem android/ is generated (gitignored); regenerate it from scratch every build
if exist android rmdir /s /q android
call npx cap add android || goto :fail
python scripts\patch-android.py || goto :fail
call npx cap sync android || goto :fail

> android\local.properties echo sdk.dir=%ANDROID_HOME:\=/%

pushd android
call .\gradlew.bat assembleDebug || (popd & goto :fail)
popd

copy /y android\app\build\outputs\apk\debug\app-debug.apk Kharcha.apk >nul || goto :fail
echo.
echo BUILD OK: %CD%\Kharcha.apk
exit /b 0

:fail
echo.
echo BUILD FAILED
exit /b 1
