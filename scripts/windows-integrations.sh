#!/bin/bash
set -e
ps=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
if [ ! -x "$ps" ]; then
  exec node --import tsx "scripts/$1-install.ts" "$2"
fi
winhome=$($ps -NoProfile -Command '[Environment]::GetFolderPath("UserProfile")' | tr -d '\r')
exec "$ps" -NoProfile -ExecutionPolicy Bypass -File "$winhome\.habblaud\integrations.ps1" "$@"
