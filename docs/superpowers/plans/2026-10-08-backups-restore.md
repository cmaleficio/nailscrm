# Backups & Restore Implementation Plan\n\n> For agentic workers: use subagent-driven-development or executing-plans. Steps use checkbox.\n\nGoal: Sistema backups/restauración manual/automático (diario/semanal/mensual), destino local C:\\Users\\Cmarffisis\\CODE\\backups\\StudioDreamNails\\, envío configurable a Drive (db|db+imagenes) vía rclone, UI pestaña Respaldar/restaurar con permiso backups.\n\nSpec: docs/superpowers/specs/2026-10-08-backups-restore-design.md\n
---
### Task 3: Librerías núcleo (paths, manifest, platform)

**Files:**
- Create: src/lib/backup-paths.ts
- Create: src/lib/backup-manifest.ts
- Create: src/lib/backup-platform.ts
- Create: src/lib/backup-paths.test.ts (en tests? o src) - seguir patrón existente

**Notas:** usar TDD. Validar rutas seguras, generar timestamp YYYY-MM-DD_HH-MM-SS, sha256, leer/escribir JSON con fs/promises.


### Task 4: Runner de backup (Node) con better-sqlite3.backup()

**Files:**
- Create: scripts/backup/backup-runner.ts
- Create: scripts/backup/lib/db-backup.ts
- Create: scripts/backup/lib/files-copy.ts

**Objetivo:** ejecutar backup manual/scheduled: crear carpeta timestamp, backup DB vía better-sqlite3.backup(), copiar public/uploads y private-uploads completos, generar manifest.json, actualizar latest.json, crear db.zip si subirá a Drive, registrar en backup_runs.


### Task 5: Runner de restore (Node)

**Files:**
- Create: scripts/backup/restore-runner.ts
- Create: scripts/backup/lib/files-restore.ts

**Objetivo:** leer manifest, validar ruta dentro de base backups, detener uso? no bloqueante. Copiar db/* a raiz repo (dev.db/wal/shm), restaurar uploads sobrescribiendo completamente. Validaciones y logs.


### Task 6: Wrappers PowerShell (Windows)

**Files:**
- Create: scripts/backup/backup-windows.ps1
- Create: scripts/backup/restore-windows.ps1
- Create: scripts/backup/sync-schedule.ps1

**Objetivo:** invocar runners Node con parámetros. sync-schedule crea/actualiza tarea schtasks según settings (frequency/hour/DOW/DOM). Documentar uso.


### Task 7: rclone helper

**Files:**
- Create: scripts/backup/lib/rclone.ts
- Create: src/lib/rclone.ts (o reutilizar)? mejor centralizar utilidades.

**Objetivo:** wrappers para test (lsd/about) y copy con timeout, captura salida, manejo errores. driveScope db/dbImages: subir DB.zip y opcional images.zip.


### Task 8: APIs REST /api/backup/*

**Files:**
- Create: src/app/api/backup/settings/route.ts (GET/PUT)
- Create: src/app/api/backup/run/route.ts (POST)
- Create: src/app/api/backup/runs/route.ts (GET)
- Create: src/app/api/backup/restore/route.ts (POST)
- Create: src/app/api/backup/test-drive/route.ts (POST)
- Create: src/app/api/backup/sync-schedule/route.ts (POST)

**Objetivo:** validar auth + permiso backups. Background spawn para run/restore (no bloquear). Validar settings según frequency. Escribir activity_logs. Validar rutas para restore.


### Task 9: UI pestaña Respaldar/restaurar en admin-users

**Files:**
- Modify: src/app/(admin)/dashboard/admin-users/AdminUsersContent.tsx (añadir pestañas)
- Create: src/app/(admin)/dashboard/admin-users/BackupRestoreSection.tsx

**Objetivo:** tabs Administradores | Etiquetas analíticas | Respaldar/restaurar. Secciones: estado último backup, backup manual, configuración (frecuencia+hora+DOW/DOM, driveScope, rcloneRemote, driveFolder, docs rclone), historial, modal restauración con escritura RESTAURAR. Solo mostrar si tiene permiso backups.


### Task 10: Ajustes UI page auth (opcional) y tests + docs

**Files:**
- Modify: src/app/(admin)/dashboard/admin-users/page.tsx (si necesario mantener guardias)
- Modify: README.md, AGENTS.md, CHANGELOG.md
- Create: tests/api/backup/*.test.ts (si aplica patrón)

**Objetivo:** asegurar guardias. Documentar configuración rclone, uso, restauración con advertencias. Añadir entradas changelog. Ejecutar lint + typecheck.


## Criterios de aceptación globales
- Backup manual crea carpeta timestamp con DB+uploads completos
- DB vía better-sqlite3.backup() consistente con WAL
- driveScope configurable (db/dbImages)
- Frecuencia daily/weekly/monthly + hora + DOW/DOM
- rclone test-drive funciona si remoto válido; documentado si no instalado
- Restauración valida ruta y requiere confirmación RESTAURAR; sobreescribe DB e imágenes
- Pestaña visible con permiso backups; acciones auditadas en activity_logs
- Windows schtasks sync via sync-schedule
- Rutas seguras (sin path traversal)

