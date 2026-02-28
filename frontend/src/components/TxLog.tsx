import React from 'react';
import { ExternalLink, ListFilter } from 'lucide-react';
import { truncateSignature } from '../utils/format';

export interface TxRecord {
  id: string;
  operation: string;
  signature: string;
  timestamp: Date;
}

export function TxLog({ logs }: { logs: TxRecord[] }) {
  return (
    <div className="panel mt-6">
      <div className="flex items-center gap-2 border-b border-border pb-3 mb-3">
        <ListFilter className="w-4 h-4 text-textSecondary" />
        <h3 className="text-sm font-medium">Session Transaction Log</h3>
      </div>
      
      {logs.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center italic">
             No transactions have been submitted in this session yet.
          </div>
      ) : (
          <div className="space-y-2">
            {logs.map((log) => (
          <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded-md hover:bg-surfaceHover transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-textSecondary w-16 text-right font-mono">
                 {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="font-medium text-textPrimary w-32 truncate">{log.operation}</span>
            </div>
            
            <a 
              href={`https://explorer.solana.com/tx/${log.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary hover:text-primaryHover transition-colors font-mono"
            >
              {truncateSignature(log.signature)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}
