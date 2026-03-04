import React, { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import type { SolanaJobQueue } from '../../../target/types/solana_job_queue';
import idl from '../../../target/idl/solana_job_queue.json';
import { Trophy, Activity, AlertCircle } from 'lucide-react';

const PROGRAM_ID = new PublicKey((idl as any).metadata?.address || (idl as any).address);

interface WorkerData {
  pubkey: string;
  authority: string;
  isActive: boolean;
  completed: number;
  failed: number;
  successRate: number;
}

export const WorkerLeaderboard = ({ queueKey }: { queueKey: string }) => {
  const { connection } = useConnection();
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchWorkers = async () => {
      try {
        const provider = new AnchorProvider(connection, {} as any, { commitment: 'confirmed' });
        const program = new Program(idl as any, provider) as Program<SolanaJobQueue>;

        const queuePubkey = new PublicKey(queueKey);
        
        // Fetch all workers that belong to this queue (offset 8 = queue pubkey)
        const workerAccounts = await program.account.worker.all([
          {
            memcmp: {
              offset: 8,
              bytes: queuePubkey.toBase58(),
            },
          },
        ]);

        const mappedWorkers = workerAccounts.map(w => {
          const completed = w.account.tasksCompleted.toNumber();
          const failed = w.account.tasksFailed.toNumber();
          const total = completed + failed;
          const successRate = total > 0 ? (completed / total) * 100 : 0;

          return {
            pubkey: w.publicKey.toBase58(),
            authority: w.account.authority.toBase58(),
            isActive: w.account.isActive,
            completed,
            failed,
            successRate
          };
        });

        // Sort by highest completed tasks
        mappedWorkers.sort((a, b) => b.completed - a.completed);
        
        setWorkers(mappedWorkers);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching workers:", err);
      }
    };

    fetchWorkers();
    interval = setInterval(fetchWorkers, 5000);

    return () => clearInterval(interval);
  }, [queueKey, connection]);

  if (loading) {
    return <div className="text-gray-400 text-sm animate-pulse p-4">Loading workers...</div>;
  }

  if (workers.length === 0) {
    return (
      <div className="bg-gray-800/30 rounded-lg p-6 text-center border border-gray-700">
        <AlertCircle className="w-8 h-8 mx-auto text-gray-500 mb-2" />
        <p className="text-gray-400 text-sm">No workers registered to this queue.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-700/50 bg-gray-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-semibold text-gray-200">Worker Leaderboard</h3>
        </div>
        <span className="text-xs font-medium text-gray-500">{workers.length} nodes</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-800/20 text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Authority</th>
              <th className="px-4 py-3 font-medium">Completed</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Failed</th>
              <th className="px-4 py-3 font-medium text-right">Success Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30 text-sm">
            {workers.map((worker, idx) => (
              <tr key={worker.pubkey} className="hover:bg-gray-700/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {idx === 0 ? <span className="text-yellow-500 font-bold">#1</span> : 
                     idx === 1 ? <span className="text-gray-400 font-bold">#2</span> :
                     idx === 2 ? <span className="text-amber-600 font-bold">#3</span> : 
                     <span className="text-gray-500">#{idx + 1}</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${worker.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></span>
                    <a 
                      href={`https://explorer.solana.com/address/${worker.authority}?cluster=devnet`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-mono"
                    >
                      {worker.authority.slice(0, 4)}..{worker.authority.slice(-4)}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-3 text-emerald-400 font-medium">{worker.completed}</td>
                <td className="px-4 py-3 text-red-400 font-medium hidden sm:table-cell">{worker.failed}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="text-gray-300">{worker.successRate.toFixed(1)}%</div>
                    <div className="flex-1 max-w-[40px] h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${worker.successRate > 90 ? 'bg-emerald-500' : worker.successRate > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                        style={{ width: `${worker.successRate}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
