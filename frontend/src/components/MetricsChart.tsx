import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import type { SolanaJobQueue } from '../../../target/types/solana_job_queue';
import idl from '../../../target/idl/solana_job_queue.json';
import { Activity } from 'lucide-react';

const PROGRAM_ID = new PublicKey((idl as any).metadata?.address || (idl as any).address);

interface ChartDataPoint {
  time: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export const MetricsChart = ({ queueKey }: { queueKey: string }) => {
  const { connection } = useConnection();
  const [data, setData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchQueueState = async () => {
      try {
        const provider = new AnchorProvider(connection, {} as any, { commitment: 'confirmed' });
        const program = new Program(idl as any, provider) as Program<SolanaJobQueue>;
        
        const queueData = await program.account.queue.fetch(new PublicKey(queueKey));
        
        const now = new Date();
        const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        const newPoint = {
          time: timeString,
          pending: queueData.pendingCount.toNumber(),
          processing: queueData.processingCount.toNumber(),
          completed: queueData.completedCount.toNumber(),
          failed: queueData.failedCount.toNumber(),
        };

        setData(prev => {
          const newData = [...prev, newPoint];
          // Keep only the last 20 data points (moving window)
          if (newData.length > 20) {
            return newData.slice(newData.length - 20);
          }
          return newData;
        });

      } catch (err) {
        console.error("Error fetching queue metrics for chart:", err);
      }
    };

    // Initial fetch
    fetchQueueState();
    // Poll every 5 seconds
    interval = setInterval(fetchQueueState, 5000);

    return () => clearInterval(interval);
  }, [queueKey, connection]);

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-500 animate-pulse">Initializing telemetry...</div>;
  }

  return (
    <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-700/50 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[40px] pointer-events-none"></div>
      
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-200">Real-Time Queue Telemetry</h3>
        <span className="ml-auto text-[10px] uppercase font-bold tracking-wider text-gray-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          Live
        </span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorProcessing" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
               <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="time" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ fontSize: '12px' }}
            />
            
            <Area type="monotone" dataKey="completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} name="Completed" />
            <Area type="monotone" dataKey="processing" stroke="#a855f7" fillOpacity={1} fill="url(#colorProcessing)" strokeWidth={2} name="Processing" />
            <Area type="monotone" dataKey="pending" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPending)" strokeWidth={2} name="Pending" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
