import { useState, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getWorkerPda } from '../utils/anchor';

export function useWorker(program: any, queuePda: PublicKey | null, walletPubkey: PublicKey | null) {
  const [isRegistered, setIsRegistered] = useState(false);
  const [workerPda, setWorkerPda] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWorkerStatus = useCallback(async () => {
    if (!program || !queuePda || !walletPubkey) {
        setIsRegistered(false);
        setWorkerPda(null);
        return;
    }
    setLoading(true);
    try {
        const [pda] = getWorkerPda(queuePda, walletPubkey);
        await program.account.worker.fetch(pda);
        setWorkerPda(pda);
        setIsRegistered(true);
    } catch (err) {
        // Worker account usually doesn't exist
        setIsRegistered(false);
        setWorkerPda(null);
    } finally {
        setLoading(false);
    }
  }, [program, queuePda, walletPubkey]);

  useEffect(() => {
    fetchWorkerStatus();
  }, [fetchWorkerStatus]);

  return {
    isRegistered,
    workerPda,
    loadingWorkerStatus: loading,
    refreshWorkerStatus: fetchWorkerStatus
  };
}
