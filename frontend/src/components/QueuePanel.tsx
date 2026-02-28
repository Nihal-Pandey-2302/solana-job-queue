import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getQueuePda } from '../utils/anchor';
import { Loader2, Hash, Download, RefreshCw, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export function QueuePanel({
  program,
  queuePda,
  queueData,
  loading,
  allQueues,
  loadingQueues,
  fetchQueue,
  loadQueueByAuthority,
  fetchAllDevnetQueues,
  onTx
}: any) {
  const { publicKey, sendTransaction } = useWallet();
  const [nameInput, setNameInput] = useState('');
  const [loadAddressInput, setLoadAddressInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize a new Queue using the SDK
  const handleInitialize = async () => {
    if (!publicKey || !nameInput) return;
    setIsInitializing(true);
    try {
      const [pda] = getQueuePda(publicKey, nameInput);
      
      const tx = await program.methods
        .initializeQueue(nameInput, 3) // max_retries = 3 default
        .accounts({
          queue: pda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      const txSig = await sendTransaction(tx, program.provider.connection);
      onTx('Initialize Queue', txSig);
      
      // Load it
      setTimeout(() => {
          fetchQueue(pda);
          if(fetchAllDevnetQueues) fetchAllDevnetQueues();
      }, 2000);
      setNameInput('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to initialize queue');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleLoad = () => {
    try {
      const pda = new PublicKey(loadAddressInput);
      fetchQueue(pda);
      setLoadAddressInput('');
    } catch {
      toast.error("Invalid Solana Address");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Address copied to clipboard");
  };

  return (
    <div className="panel flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-medium">Queue Dashboard</h2>
          <p className="text-sm text-textSecondary mt-1">Manage decentralized job queues.</p>
        </div>
      </div>

      {!queuePda && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-slate-300">Create New Workspace</h3>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                className="input flex-1" 
                placeholder="Queue Name (e.g., 'email-jobs')"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <button 
                className="btn-primary w-full py-3" 
                disabled={isInitializing || !nameInput || !publicKey}
                onClick={handleInitialize}
              >
                {isInitializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                Initialize Queue
              </button>
            </div>
            {!publicKey && <p className="text-xs text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-lg">Connect wallet to initialize</p>}

            <h3 className="text-sm font-semibold text-slate-300 mt-6 pt-6 border-t border-slate-800">Load Existing PDA</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="input flex-1 font-mono text-xs" 
                placeholder="Queue PDA Address"
                value={loadAddressInput}
                onChange={(e) => setLoadAddressInput(e.target.value)}
              />
              <button 
                className="btn-secondary whitespace-nowrap"
                disabled={!loadAddressInput || loading}
                onClick={handleLoad}
              >
                <Download className="w-4 h-4" /> Load
              </button>
            </div>
          </div>

          <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-semibold text-slate-300">Global Devnet Queues</h3>
               <button onClick={fetchAllDevnetQueues} className="text-slate-500 hover:text-slate-300 transition-colors">
                   <RefreshCw className={`w-4 h-4 ${loadingQueues ? 'animate-spin' : ''}`} />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {loadingQueues && allQueues?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin mb-2" /> Loading globally...
                    </div>
                ) : allQueues?.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                        No active queues on Devnet.
                    </div>
                ) : (
                    allQueues?.map((q: any) => (
                        <div key={q.publicKey.toBase58()} 
                             onClick={() => fetchQueue(q.publicKey)}
                             className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 p-3 rounded-lg cursor-pointer transition-all">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-200">{q.account.name}</span>
                                <span className="text-[10px] bg-slate-800 group-hover:bg-slate-950 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                                    {q.account.totalTasks.toNumber()} Tasks
                                </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-1.5 truncate">
                                {q.publicKey.toBase58()}
                            </div>
                        </div>
                    ))
                )}
            </div>
          </div>
        </div>
      )}

      {queuePda && queueData && (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
             <div className="space-y-1">
                 <div className="flex items-center gap-2">
                     <span className="text-2xl font-bold">{queueData.name}</span>
                 </div>
                 <div className="flex items-center gap-2 text-sm text-textSecondary group">
                     <Hash className="w-3.5 h-3.5" />
                     <span className="font-mono cursor-pointer hover:text-textPrimary transition-colors"
                           onClick={() => copyToClipboard(queuePda.toBase58())}>
                         {queuePda.toBase58()}
                     </span>
                 </div>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Tasks" value={queueData.totalTasks.toString()} />
            <StatCard label="Pending" value={queueData.pendingCount.toString()} color="text-yellow-500" />
            <StatCard label="Processing" value={queueData.processingCount.toString()} color="text-blue-500" />
            <StatCard label="Completed" value={queueData.completedCount.toString()} color="text-green-500" />
            <StatCard label="Failed" value={queueData.failedCount.toString()} color="text-red-500" />
          </div>
          <div className="flex justify-center mt-6 pt-2">
              <button 
                  className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4 transition-colors" 
                  onClick={() => fetchQueue(null)}
              >
                  Close Workspace (Return to Dashboard)
              </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-textPrimary" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-background border border-border rounded-md p-4 flex flex-col items-center justify-center">
      <span className="text-xs text-textSecondary mb-1 uppercase tracking-wider font-semibold">{label}</span>
      <span className={`text-2xl font-mono ${color}`}>{value}</span>
    </div>
  );
}
