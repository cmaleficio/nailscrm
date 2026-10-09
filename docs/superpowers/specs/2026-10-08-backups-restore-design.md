# Backups & Restore - Diseño

Fecha: 2026-10-08
Estado: Validado

## Objetivo
Sistema de respaldo/restauración para DB e imágenes: manual/automático (diario/semanal/mensual), destino local C:\Users\Cmarffisis\CODE\backups\StudioDreamNails\, envío configurable a Google Drive (solo DB o DB+Imágenes) vía rclone, restauración con confirmación, pestaña en admin-users con permiso backups, núcleo Node.js multiplataforma.

## 1. Multiplataforma
Núcleo portable en scripts/backup/ (TypeScript + Node.js), wrappers .ps1 Windows, futuro .sh Linux. process.platform. Windows schtasks.exe, Linux cron.

## 2. Estructura
{YYYY-MM-DD_HH-MM-SS}/ con db/, public/uploads/, private/uploads/, manifest.json; latest.json. better-sqlite3.backup() para DB consistente. No incremental.

## 3. Esquema Drizzle
backup_settings (singleton) y backup_runs (historial). Soporta daily/weekly/monthly, driveScope db|dbImages, rcloneRemote, driveFolder, DOW/DOM.

## 4. Permisos
Añadir backups a PERMISSION_KEYS/PERMISSION_LABELS. Cualquier admin con permiso backups puede operar.

## 5. APIs
GET/PUT /api/backup/settings, POST /api/backup/run, GET /api/backup/runs, POST /api/backup/restore, POST /api/backup/test-drive, POST /api/backup/sync-schedule. Auditoría en activity_logs.

## 6. UI
Pestaña Respaldar/restaurar en AdminUsersContent: estado, manual, configuración (frecuencia+hora+DOW/DOM, driveScope, remotos, documentación rclone), historial, modal restauración con texto RESTAURAR.

## 7. Google Drive
rclone copy. db o db+images. Test con lsd/about. rclone no instalado (documentar).

## 8. Seguridad
Validación de rutas (sin .. fuera de base), manifest obligatorio, doble confirmación, auditoría completa.

## 9. Archivos a tocar
permissions.ts, schema.ts+migración, admin-users/*, app/api/backup/*, scripts/backup/*, README.md, AGENTS.md, CHANGELOG.md.
