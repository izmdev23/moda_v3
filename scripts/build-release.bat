@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "SKIP_PREBUILD=0"

if /I "%~1"=="--skip-prebuild" (
  set "SKIP_PREBUILD=1"
)

cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [ERROR] Failed to move to project root: "%PROJECT_ROOT%"
  exit /b 1
)

echo [INFO] Project root: %CD%

if "%SKIP_PREBUILD%"=="0" (
  echo [1/2] Running Expo prebuild for Android...
  call npx expo prebuild --platform android --non-interactive
  if errorlevel 1 (
    echo [ERROR] Expo prebuild failed.
    exit /b 1
  )
) else (
  echo [1/2] Skipping Expo prebuild - --skip-prebuild
)

echo [2/2] Building Android release APK...
pushd android
if errorlevel 1 (
  echo [ERROR] Could not enter android directory.
  exit /b 1
)

call gradlew.bat assembleRelease
set "BUILD_EXIT=%ERRORLEVEL%"
popd

if not "%BUILD_EXIT%"=="0" (
  echo [ERROR] Release build failed with exit code %BUILD_EXIT%.
  exit /b %BUILD_EXIT%
)

set "APK_PATH=%CD%\android\app\build\outputs\apk\release\app-release.apk"

echo [SUCCESS] Release build completed.
if exist "%APK_PATH%" (
  echo [INFO] APK: "%APK_PATH%"
) else (
  echo [WARN] Build succeeded, but APK was not found at expected path.
)

exit /b 0
