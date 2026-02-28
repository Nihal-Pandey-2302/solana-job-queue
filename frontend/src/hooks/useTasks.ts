import { useState, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';

export function useTasks(program: any, queuePda: PublicKey | null) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!program || !queuePda) {
        setTasks([]);
        return;
    }
    setLoading(true);
    try {
        // We fetch all task accounts that belong to this queue id using `memcmp`
        // The `queue` property is the first property in the Task struct after the 8 byte discriminator
        const rawTasks = await program.account.task.all([
            {
               memcmp: {
                   offset: 8,
                   bytes: queuePda.toBase58()
               }
            }
        ]);
        
        // Sort by priority (descending) then by task_id
        const sorted = rawTasks.sort((a: any, b: any) => {
            const pA = a.account.priority;
            const pB = b.account.priority;
            if (pA !== pB) return pB - pA;
            return a.account.taskId.toNumber() - b.account.taskId.toNumber();
        });
        
        setTasks(sorted);
    } catch (err) {
        console.error("Failed to fetch tasks", err);
        setTasks([]);
    } finally {
        setLoading(false);
    }
  }, [program, queuePda]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loadingTasks: loading,
    refreshTasks: fetchTasks
  };
}
