/**
 * Logs Page
 * 
 * Full-page log viewer with all controls
 */

import LogViewer from '../components/LogViewer';

export default function LogsPage() {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">Logs</h1>
        <p className="text-white/60 text-sm">View and search Unbound DNS resolver logs</p>
      </div>

      <div className="flex-1 min-h-0">
        <LogViewer 
          maxHeight="calc(100vh - 200px)"
          showHeader={true}
        />
      </div>
    </div>
  );
}
