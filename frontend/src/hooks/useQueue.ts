import { useState, useCallback, useEffect, useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getProgram, getQueuePda } from '../utils/anchor';

export function useQueue() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [queueName, setQueueName] = useState<string>('');
  const [queuePda, setQueuePda] = useState<PublicKey | null>(null);
  const [queueData, setQueueData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allQueues, setAllQueues] = useState<any[]>([]);
  const [loadingQueues, setLoadingQueues] = useState(false);

  const program = useMemo(() => {
    const provider = wallet ? new AnchorProvider(connection, wallet, {}) : null;
    return provider ? getProgram(provider) : getProgram(new AnchorProvider(connection, {
      publicKey: PublicKey.default,
      signTransaction: async () => { throw new Error('Dummy') },
      signAllTransactions: async () => { throw new Error('Dummy') }
    } as any, {}));
  }, [connection, wallet]);

  const fetchQueue = useCallback(async (pda: PublicKey) => {
    setLoading(true);
    setError(null);
    try {
        const data = await program.account.queue.fetch(pda);
        setQueuePda(pda);
        setQueueName(data.name);
        setQueueData(data);
    } catch (err: any) {
        console.error("Failed to fetch queue", err);
        setError("Queue not found or failed to load");
        setQueuePda(null);
        setQueueData(null);
    } finally {
        setLoading(false);
    }
  }, [program]);

  // Optionally load a known active loaded queue
  const loadQueueByAuthority = useCallback(async (authority: PublicKey, name: string) => {
      const [pda] = getQueuePda(authority, name);
      await fetchQueue(pda);
  }, [fetchQueue]);
  
  const refreshQueue = useCallback(async () => {
      if (queuePda) await fetchQueue(queuePda);
  }, [queuePda, fetchQueue]);

  const fetchAllDevnetQueues = useCallback(async () => {
      if (!program) return;
      setLoadingQueues(true);
      try {
          const discriminator = (program.coder.accounts as any).accountDiscriminator('queue');
          const accounts = await connection.getProgramAccounts(program.programId, {
              filters: [
                  { memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(discriminator) } }
              ]
          });
          
          const validQueues = [];
          for (const acc of accounts) {
              try {
                  const decoded = program.coder.accounts.decode('queue', acc.account.data);
                  validQueues.push({ publicKey: acc.pubkey, account: decoded });
              } catch (e) {
                  // Ignore legacy schema mismatches
              }
          }
          setAllQueues(validQueues);
      } catch (err) {
          console.error("Failed to fetch all queues", err);
      } finally {
          setLoadingQueues(false);
      }
  }, [program]);

  useEffect(() => {
      if (!queuePda) {
          fetchAllDevnetQueues();
      }
  }, [queuePda, fetchAllDevnetQueues]);

  return {
    program,
    queueName,
    queuePda,
    queueData,
    loading,
    error,
    allQueues,
    loadingQueues,
    fetchQueue,
    loadQueueByAuthority,
    refreshQueue,
    fetchAllDevnetQueues
  };
}
