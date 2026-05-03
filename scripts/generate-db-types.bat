@echo off
setlocal

set "OUTPUT=supabase\database.types.ts"
set "TMP=supabase\database.types.tmp.ts"

if exist "%TMP%" del /f /q "%TMP%"

echo Generating Supabase database types...
echo.

echo [1/2] Trying linked remote project...
call npx supabase gen types typescript --linked --schema public > "%TMP%"
if not errorlevel 1 goto verify

echo.
echo [2/2] Linked project generation failed. Trying local Supabase...
call npx supabase gen types typescript --local --schema public > "%TMP%"
if errorlevel 1 goto fail

:verify
for %%A in ("%TMP%") do set "TMP_SIZE=%%~zA"
if "%TMP_SIZE%"=="0" goto fail

findstr /i /c:"\"upperwear\"" "%TMP%" >nul
if errorlevel 1 goto stale_schema

findstr /i /c:"\"lowerwear\"" "%TMP%" >nul
if errorlevel 1 goto stale_schema

findstr /i /c:"is_full_body" "%TMP%" >nul
if errorlevel 1 goto stale_schema

copy /y "%TMP%" "%OUTPUT%" >nul
if errorlevel 1 goto fail

if exist "%TMP%" del /f /q "%TMP%" >nul 2>&1

echo.
echo Successfully generated %OUTPUT%
exit /b 0

:stale_schema
if exist "%TMP%" del /f /q "%TMP%"
echo.
echo Generated schema is outdated and missing expected enum/variant fields.
echo - Ensure new migrations are applied to your linked/local database.
echo - Then run this script again.
exit /b 1

:fail
if exist "%TMP%" del /f /q "%TMP%"
echo.
echo Failed to generate database types.
echo - For remote mode: run "supabase login" and "supabase link" first.
echo - For local mode: ensure Docker Desktop is running and local Supabase is started.
exit /b 1