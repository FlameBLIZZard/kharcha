# Building the Kharcha APK locally (Windows)

## One go

```bat
build-apk.bat
```

Output: `Kharcha.apk` in this folder. Install it over the old one; every build is signed with the same key, so it updates in place without wiping data.

## Build and send to the phone

```bat
build-and-send.bat
```

Pulls the latest code, runs `build-apk.bat`, then sends `Kharcha.apk` to Telegram using `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from `%USERPROFILE%\.telegram-bot.env`. The APK's version is `1.<commit count> (<hash>)`, shown in Setup, so you can tell which build is installed.

## Toolchain on this PC

| Tool | Where | How it got there |
|---|---|---|
| Node 20+ / npm | on PATH | already installed |
| Python 3 | on PATH | already installed (runs `scripts/patch-android.py`) |
| JDK 17 (Temurin) | `C:\Program Files\Eclipse Adoptium\jdk-17.*` | `winget install --id EclipseAdoptium.Temurin.17.JDK -e` |
| Android SDK | `C:\Users\Admin\Android\Sdk` | command-line tools zip from developer.android.com, unzipped to `Sdk\cmdline-tools\latest` |
| Signing key | `C:\Users\Admin\.android\debug.keystore` | `keytool` (below). Gradle picks it up automatically. **Never commit it; back it up** — lose it and the next APK won't install over the old one. |

SDK packages (run from `cmd`; licence prompts need a real stdin):

```bat
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot
set SDK=C:\Users\Admin\Android\Sdk
%SDK%\cmdline-tools\latest\bin\sdkmanager.bat --sdk_root=%SDK% --licenses
%SDK%\cmdline-tools\latest\bin\sdkmanager.bat --sdk_root=%SDK% platform-tools "platforms;android-34" "build-tools;34.0.0"
```

Keystore (made once):

```bat
keytool -genkeypair -keystore %USERPROFILE%\.android\debug.keystore -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=Kharcha"
```

## What `build-apk.bat` runs

```bat
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17...
set ANDROID_HOME=%USERPROFILE%\Android\Sdk
npm install
npm test
npm run build:www
rmdir /s /q android          & rem generated folder, rebuilt each time
npx cap add android
python scripts\patch-android.py
npx cap sync android
echo sdk.dir=C:/Users/Admin/Android/Sdk> android\local.properties
cd android && .\gradlew.bat assembleDebug   & rem the .\ matters on this PC
copy android\app\build\outputs\apk\debug\app-debug.apk Kharcha.apk
```

The first Gradle run downloads Gradle and dependencies (~a few hundred MB into `%USERPROFILE%\.gradle`), later builds are faster.

## Notes

- `android/`, `www/` and `node_modules/` are generated and gitignored.
- `NoDefaultCurrentDirectoryInExePath=1` is set on this PC, so cmd won't run `gradlew.bat` from the current folder without `.\`.
- Get the latest source first: `git pull` (this folder is a clone of `feat/kharcha-app`).
- If a folder rename fails with "access denied", a Gradle daemon is holding it: `cd android && .\gradlew.bat --stop`.
- Phones that have the GitHub Actions build installed need it uninstalled once, since that one was signed with a different key.
