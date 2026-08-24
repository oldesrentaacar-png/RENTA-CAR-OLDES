@echo off
REM Genera un solo archivo SQL para pegar en Supabase SQL Editor
cd /d "%~dp0.."
set OUT=supabase\ALL_MIGRATIONS_COMBINED.sql
echo -- OLDES Rent-a-Car: ejecutar UNA VEZ en Supabase SQL Editor > "%OUT%"
echo -- Project Settings ^> Database ^> SQL Editor ^> New query >> "%OUT%"
echo. >> "%OUT%"
for %%f in (supabase\migrations\*.sql) do (
  echo -- ===== %%~nxf ===== >> "%OUT%"
  type "%%f" >> "%OUT%"
  echo. >> "%OUT%"
)
echo Archivo generado: %OUT%
