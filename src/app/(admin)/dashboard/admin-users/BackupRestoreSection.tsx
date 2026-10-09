"use client";
import { useState, useEffect } from 'react';

export function BackupRestoreSection() {
  const [settings, setSettings] = useState<any>({ enabled: false, frequency: 'daily', hour: 21, minute: 0, driveScope: 'db', rcloneRemote: '', driveFolder: '' });
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/backup/settings').then(r=>r.json()).then(setSettings).catch(()=>{});
    fetch('/api/backup/runs').then(r=>r.json()).then(setRuns).catch(()=>{});
  }, []);

  async function manualBackup() {
    setLoading(true);
    try { await fetch('/api/backup/run', { method: 'POST' }); } finally { setLoading(false); }
  }

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Respaldar/restaurar</h2>
      <div className="mt-4 flex gap-2">
        <button onClick={manualBackup} disabled={loading} className="rounded-xl bg-pink-main px-4 py-2 text-sm">Crear respaldo ahora</button>
      </div>
    </div>
  );
}