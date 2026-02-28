import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { getStatusColor, getStatusLabel } from '../utils/format';
import { getTaskPda } from '../utils/anchor';
import toast from 'react-hot-toast';

export function TaskList({
  program,
  queuePda,
  tasks,
  loadingTasks,
  refreshTasks,
  refreshQueue,
  onTx
}: any) {
  const { publicKey, sendTransaction } = useWallet();
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed'>('all');
  const [closingId, setClosingId] = useState<number | null>(null);

  if (!queuePda) return null;

  const filteredTasks = tasks.filter((t: any) => {
      if (filter === 'all') return true;
      return !!t.account.status[filter];
  });

  const handleClose = async (taskId: number) => {
      if (!publicKey) return;
      setClosingId(taskId);
      try {
        const [taskPda] = getTaskPda(queuePda, taskId);
        const tx = await program.methods
          .closeTask()
          .accounts({
            task: taskPda,
            queue: queuePda,
            authority: publicKey,
          })
          .transaction();
  
        const txSig = await sendTransaction(tx, program.provider.connection);
        onTx(`Close Task #${taskId}`, txSig);
        
        setTimeout(() => { refreshTasks(); refreshQueue(); }, 2000);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to close task');
      } finally {
        setClosingId(null);
      }
  };

  return (
    <div className="panel col-span-1 md:col-span-2 flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <h2 className="text-lg font-medium">Task Explorer</h2>
        <div className="flex items-center gap-2">
            <select 
                className="input py-1.5 px-2 text-xs w-32"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
            >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
            </select>
            <button 
                onClick={refreshTasks}
                disabled={loadingTasks}
                className="p-1.5 rounded-md hover:bg-surfaceHover text-textSecondary transition-colors disabled:opacity-50"
            >
                <RefreshCw className={`w-4 h-4 ${loadingTasks ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface/50 border-b border-border text-textSecondary sticky top-0">
                  <tr>
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Prio</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Depends</th>
                      <th className="px-4 py-3 font-medium">Payload Preview</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-border">
                  {loadingTasks && tasks.length === 0 ? (
                      <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-textSecondary">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                              Loading tasks...
                          </td>
                      </tr>
                  ) : filteredTasks.length === 0 ? (
                      <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-textSecondary">
                              No tasks found
                          </td>
                      </tr>
                  ) : (
                      filteredTasks.map((t: any) => {
                          const id = t.account.taskId.toNumber();
                          const canClose = !!(t.account.status.completed || t.account.status.failed);
                          const isClosing = closingId === id;
                          
                          return (
                              <tr key={t.publicKey.toBase58()} className="hover:bg-surfaceHover/30 transition-colors">
                                  <td className="px-4 py-3 font-mono">{id}</td>
                                  <td className="px-4 py-3 font-mono">{t.account.priority}</td>
                                  <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusColor(t.account.status)}`}>
                                          {getStatusLabel(t.account.status)}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs text-textSecondary">
                                      {t.account.dependsOn !== null ? `#${t.account.dependsOn.toNumber()}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px] text-textSecondary">
                                      {t.account.payload}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      {canClose ? (
                                           <button 
                                             onClick={() => handleClose(id)}
                                             disabled={!publicKey || isClosing}
                                             className="text-xs flex items-center gap-1 ml-auto text-textSecondary hover:text-danger disabled:opacity-50 transition-colors"
                                             title="Reclaim Rent"
                                           >
                                               {isClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                               Close
                                           </button>
                                      ) : (
                                          <span className="text-xs text-border">-</span>
                                      )}
                                  </td>
                              </tr>
                          );
                      })
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
}
