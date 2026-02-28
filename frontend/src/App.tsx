import { useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Toaster } from 'react-hot-toast';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';
import { DEVNET_URL } from './utils/anchor';

import { Header } from './components/Header';
import { QueuePanel } from './components/QueuePanel';
import { WorkerPanel } from './components/WorkerPanel';
import { TaskActions } from './components/TaskActions';
import { TaskList } from './components/TaskList';
import { TxLog, type TxRecord } from './components/TxLog';
import { showTxToast } from './utils/toastLog';

import { useQueue } from './hooks/useQueue';
import { useWorker } from './hooks/useWorker';
import { useTasks } from './hooks/useTasks';

function Dashboard() {
  const { program, queuePda, queueData, loading: queueLoading, fetchQueue, loadQueueByAuthority, refreshQueue, allQueues, loadingQueues, fetchAllDevnetQueues } = useQueue();
  const { isRegistered, workerPda, refreshWorkerStatus } = useWorker(program, queuePda, program.provider ? (program.provider as any).wallet?.publicKey : null);
  const { tasks, loadingTasks, refreshTasks } = useTasks(program, queuePda);
  
  const [logs, setLogs] = useState<TxRecord[]>([]);

  const handleTx = (operation: string, signature: string) => {
      showTxToast(operation, signature);
      setLogs(prev => [
          {
              id: Math.random().toString(),
              operation,
              signature,
              timestamp: new Date()
          },
          ...prev
      ].slice(0, 10)); // Keep last 10
  };

  return (
     <div className="max-w-6xl mx-auto p-4 md:p-8 min-h-screen flex flex-col">
       <Header />
       
       <main className="flex-1 space-y-6">
          <QueuePanel 
              program={program}
              queuePda={queuePda}
              queueData={queueData}
              loading={queueLoading}
              allQueues={allQueues}
              loadingQueues={loadingQueues}
              fetchQueue={fetchQueue}
              loadQueueByAuthority={loadQueueByAuthority}
              fetchAllDevnetQueues={fetchAllDevnetQueues}
              onTx={handleTx}
          />
          
          <WorkerPanel 
              program={program}
              queuePda={queuePda}
              isRegistered={isRegistered}
              workerPda={workerPda}
              refreshWorkerStatus={refreshWorkerStatus}
              onTx={handleTx}
          />
          
          {queuePda && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <TaskActions 
                    program={program}
                    queuePda={queuePda}
                    queueData={queueData}
                    workerPda={workerPda}
                    isRegistered={isRegistered}
                    refreshQueue={refreshQueue}
                    refreshTasks={refreshTasks}
                    onTx={handleTx}
                />
                
                <TaskList
                    program={program}
                    queuePda={queuePda}
                    tasks={tasks}
                    loadingTasks={loadingTasks}
                    refreshTasks={refreshTasks}
                    refreshQueue={refreshQueue}
                    onTx={handleTx}
                />
            </div>
          )}
          
          <TxLog logs={logs} />
       </main>
     </div>
  );
}

function App() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={DEVNET_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Toaster 
            position="bottom-right" 
            toastOptions={{
                style: {
                    background: '#171717',
                    color: '#ededed',
                    border: '1px solid #333333',
                    fontSize: '14px',
                    fontFamily: 'Inter, sans-serif'
                }
            }}
          />
          <Dashboard />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
