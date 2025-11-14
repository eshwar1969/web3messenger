'use client';

import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for log events from the app
    const handleLog = (event: CustomEvent<{ message: string; type: string }>) => {
      const timestamp = new Date().toLocaleTimeString();
      const newLog: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        message: event.detail.message,
        type: event.detail.type as LogEntry['type'],
        timestamp
      };
      setLogs(prev => [...prev, newLog]);
    };

    window.addEventListener('app-log' as any, handleLog as EventListener);
    return () => {
      window.removeEventListener('app-log' as any, handleLog as EventListener);
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
    // Dispatch a log event for clearing
    window.dispatchEvent(new CustomEvent('app-log', {
      detail: { message: 'Activity log cleared', type: 'info' }
    }));
  };

  return (
    <div className="chat-panel logs-panel">
      <div className="panel-header">
        <h2>Activity</h2>
        <button id="clearLogs" className="ghost-action" onClick={clearLogs}>
          Clear
        </button>
      </div>
      <div id="logs" className="logs">
        {logs.length === 0 ? (
          <div className="empty-state">
            <p>Activity will appear here</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              [{log.timestamp}] {log.message}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default ActivityLogs;

