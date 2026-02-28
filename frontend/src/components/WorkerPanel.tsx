import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SystemProgram } from '@solana/web3.js';
import { getWorkerPda } from '../utils/anchor';
import { Loader2, Activity, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';

export function WorkerPanel({
  program,
  queuePda,
  isRegistered,
  workerPda,
  refreshWorkerStatus,
  onTx
}: any) {
  const { publicKey, sendTransaction } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!queuePda) return null;

  const handleRegister = async () => {
    if (!publicKey) return;
    setIsSubmitting(true);
    try {
      const [pda] = getWorkerPda(queuePda, publicKey);
      
      const tx = await program.methods
        .registerWorker()
        .accounts({
          worker: pda,
          queue: queuePda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      const txSig = await sendTransaction(tx, program.provider.connection);
      onTx('Register Worker', txSig);
      
      setTimeout(refreshWorkerStatus, 2000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to register worker');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeregister = async () => {
    if (!publicKey || !workerPda) return;
    setIsSubmitting(true);
    try {
      const tx = await program.methods
        .deregisterWorker()
        .accounts({
          worker: workerPda,
          authority: publicKey,
        })
        .transaction();

      const txSig = await sendTransaction(tx, program.provider.connection);
      onTx('Unregister Worker', txSig);
      
      setTimeout(refreshWorkerStatus, 2000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to deregister worker');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="panel flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isRegistered ? 'bg-green-500/10 text-green-500' : 'bg-border text-textSecondary'}`}>
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-medium text-sm">Worker Status</h3>
          <p className="text-xs text-textSecondary">
            {!publicKey ? 'Wallet not connected' : 
             isRegistered ? 'Active • You can claim tasks' : 'Inactive • Registration required'}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2">
        {publicKey && !isRegistered && (
          <button 
            className="btn-primary"
            onClick={handleRegister}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Register Worker
          </button>
        )}
        
        {publicKey && isRegistered && (
          <button 
            className="btn-danger"
            onClick={handleDeregister}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
            Deregister Node
          </button>
        )}
      </div>
    </div>
  );
}
