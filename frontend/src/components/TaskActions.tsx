import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getTaskPda, getWorkerPda } from '../utils/anchor';
import { Loader2, Plus, Play, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function TaskActions({
  program,
  queuePda,
  queueData,
  workerPda,
  isRegistered,
  refreshQueue,
  refreshTasks,
  onTx
}: any) {
  const { publicKey, sendTransaction } = useWallet();
  const [activeTab, setActiveTab] = useState<'enqueue' | 'process' | 'complete' | 'fail'>('enqueue');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enqueue Form
  const [payload, setPayload] = useState('{"hello": "world"}');
  const [priority, setPriority] = useState(10);
  const [delay, setDelay] = useState<string>('');
  const [dependsOn, setDependsOn] = useState<string>('');

  // Resolution Forms
  const [completeTaskId, setCompleteTaskId] = useState('');
  const [completeResult, setCompleteResult] = useState('{"status": "success"}');
  const [failTaskId, setFailTaskId] = useState('');

  if (!queuePda || !queueData) return null;

  const handleEnqueue = async () => {
    if (!publicKey) return;
    if (Buffer.from(payload).length > 512) {
        toast.error('Payload exceeds 512 bytes');
        return;
    }
    setIsSubmitting(true);
    try {
      const taskId = queueData.totalTasks;
      const [taskPda] = getTaskPda(queuePda, taskId);
      
      let dependsOnVal = null;
      let remainingAccounts = [];
      if (dependsOn && dependsOn.trim() !== '') {
          dependsOnVal = new anchor.BN(parseInt(dependsOn));
          const [depTaskPda] = getTaskPda(queuePda, parseInt(dependsOn));
          remainingAccounts.push({
              pubkey: depTaskPda,
              isWritable: false,
              isSigner: false,
          });
      }

      const tx = await program.methods
        .enqueueTask(
            payload, 
            priority, 
            delay ? new anchor.BN(parseInt(delay)) : new anchor.BN(0),
            dependsOnVal
        )
        .accounts({
          task: taskPda,
          queue: queuePda,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();

      const txSig = await sendTransaction(tx, program.provider.connection);
      onTx(`Enqueue Task #${taskId.toString()}`, txSig);
      
      setPayload('{"hello": "world"}');
      setDependsOn('');
      
      setTimeout(() => { refreshQueue(); refreshTasks(); }, 2000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to enqueue task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcess = async () => {
      if (!publicKey || !workerPda) return;
      setIsSubmitting(true);
      try {
        // To process, we actually need to know WHICH task the heap will pop
        // The simplest way to do this in the UI without guessing is to let the user
        // select the task from the list, or we fetch the queue account, look at priority_heap[0]
        // Which is what processTask does. But processTask needs the `task` PDA as an account!
        // Read the queue data to find the highest priority task:
        if (queueData.heapSize === 0) {
            toast.error("No pending tasks in the priority heap");
            setIsSubmitting(false);
            return;
        }

        const topTask = queueData.priorityHeap[0];
        const taskId = topTask.taskId.toNumber();
        const [taskPda] = getTaskPda(queuePda, taskId);

        // Does it have a dependency? We need to fetch the task to find out.
        const taskData = await program.account.task.fetch(taskPda);
        let remainingAccounts = [];
        if (taskData.dependsOn !== null) {
            const depId = taskData.dependsOn.toNumber();
            const [depTaskPda] = getTaskPda(queuePda, depId);
            remainingAccounts.push({
                pubkey: depTaskPda,
                isWritable: false,
                isSigner: false
             });
        }

        const tx = await program.methods
          .processTask()
          .accounts({
            worker: workerPda,
            task: taskPda,
            queue: queuePda,
            authority: publicKey,
          })
          .remainingAccounts(remainingAccounts)
          .transaction();

        const txSig = await sendTransaction(tx, program.provider.connection);
        onTx(`Process Task #${taskId}`, txSig);
        
        setTimeout(() => { refreshQueue(); refreshTasks(); }, 2000);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to process task');
      } finally {
        setIsSubmitting(false);
      }
  };

  const handleComplete = async () => {
    if (!publicKey || !workerPda || !completeTaskId) return;
    setIsSubmitting(true);
    try {
      const [taskPda] = getTaskPda(queuePda, parseInt(completeTaskId));
      
      const tx = await program.methods
        .completeTask(completeResult)
        .accounts({
          worker: workerPda,
          task: taskPda,
          queue: queuePda,
          authority: publicKey,
        })
        .transaction();

      const txSig = await sendTransaction(tx, program.provider.connection);
      onTx(`Complete Task #${completeTaskId}`, txSig);
      
      setTimeout(() => { refreshQueue(); refreshTasks(); }, 2000);
      setCompleteTaskId('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to complete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFail = async () => {
    if (!publicKey || !workerPda || !failTaskId) return;
    setIsSubmitting(true);
    try {
      const [taskPda] = getTaskPda(queuePda, parseInt(failTaskId));
      
      const tx = await program.methods
        .failTask()
        .accounts({
          worker: workerPda,
          task: taskPda,
          queue: queuePda,
          authority: publicKey,
        })
        .transaction();

      const txSig = await sendTransaction(tx, program.provider.connection);
      onTx(`Fail Task #${failTaskId}`, txSig);
      
      setTimeout(() => { refreshQueue(); refreshTasks(); }, 2000);
      setFailTaskId('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to fail task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'enqueue', label: 'Enqueue' },
    { id: 'process', label: 'Process' },
    { id: 'complete', label: 'Complete' },
    { id: 'fail', label: 'Fail' }
  ];

  return (
    <div className="panel col-span-1 border-border">
      <div className="flex space-x-1 border-b border-border pb-3 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.id 
                ? 'bg-surfaceHover text-textPrimary' 
                : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceHover/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[280px]">
        {!publicKey ? (
          <div className="flex flex-col items-center justify-center h-full text-textSecondary text-sm py-12">
            Connect wallet to perform actions
          </div>
        ) : (
            <>
                {/* ENQUEUE TAB */}
                {activeTab === 'enqueue' && (
                    <div className="space-y-4">
                        <div>
                            <label className="label flex justify-between">
                                Payload (JSON)
                                <span className={Buffer.from(payload).length > 512 ? 'text-danger' : 'text-textSecondary'}>
                                    {Buffer.from(payload).length}/512 bytes
                                </span>
                            </label>
                            <textarea
                                className="input min-h-[80px] font-mono text-xs"
                                value={payload}
                                onChange={e => setPayload(e.target.value)}
                            />
                        </div>
                        
                        <div>
                            <label className="label flex justify-between">
                                Priority Level: <span className="text-primary">{priority}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="255"
                                value={priority}
                                onChange={e => setPriority(parseInt(e.target.value))}
                                className="w-full accent-primary"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Depends On (Task ID)</label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="Optional"
                                    value={dependsOn}
                                    onChange={e => setDependsOn(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Delay (Seconds)</label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="Optional"
                                    value={delay}
                                    onChange={e => setDelay(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            className="btn-primary w-full mt-2"
                            onClick={handleEnqueue}
                            disabled={isSubmitting || Buffer.from(payload).length > 512}
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Enqueue Task
                        </button>
                    </div>
                )}

                {/* PROCESS TAB */}
                {activeTab === 'process' && (
                    <div className="space-y-4 flex flex-col h-full justify-center py-4">
                        <div className="bg-primary/5 border border-primary/20 rounded-md p-4 text-sm text-textSecondary text-center mb-4">
                            Worker will claim the highest priority task currently in the `Pending` state via the **O(log n)** Priority Max-Heap.
                        </div>
                        
                        {!isRegistered ? (
                             <p className="text-center text-sm text-yellow-500">You must register as a worker first.</p>
                        ) : (
                            <button 
                                className="btn-primary w-full py-3"
                                onClick={handleProcess}
                                disabled={isSubmitting || queueData?.heapSize === 0}
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Process Next Priority Task
                            </button>
                        )}
                        {queueData?.heapSize === 0 && <p className="text-xs text-center text-textSecondary mt-2">No tasks in heap</p>}
                    </div>
                )}

                {/* COMPLETE TAB */}
                {activeTab === 'complete' && (
                    <div className="space-y-4">
                        {!isRegistered ? (
                             <p className="text-center text-sm mb-4 text-yellow-500 py-4">You must register as a worker first.</p>
                        ) : (
                            <>
                                <div>
                                    <label className="label">Task ID</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="E.g., 0"
                                        value={completeTaskId}
                                        onChange={e => setCompleteTaskId(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label">Result Payload (JSON)</label>
                                    <textarea
                                        className="input min-h-[80px] font-mono text-xs"
                                        value={completeResult}
                                        onChange={e => setCompleteResult(e.target.value)}
                                    />
                                </div>
                                <button 
                                    className="btn-primary w-full !bg-green-600 hover:!bg-green-700"
                                    onClick={handleComplete}
                                    disabled={isSubmitting || !completeTaskId}
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Complete Task
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* FAIL TAB */}
                {activeTab === 'fail' && (
                    <div className="space-y-4">
                       {!isRegistered ? (
                             <p className="text-center text-sm mb-4 text-yellow-500 py-4">You must register as a worker first.</p>
                        ) : (
                            <>
                                <div>
                                    <label className="label">Task ID</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="E.g., 0"
                                        value={failTaskId}
                                        onChange={e => setFailTaskId(e.target.value)}
                                    />
                                </div>
                                <div className="bg-red-500/5 border border-red-500/20 rounded-md p-4 text-xs text-textSecondary mb-4">
                                    Failing a task will decrement its retry count. If retries hit 0, it routes to Dead Letter (Failed status). Otherwise it returns to the Pending Heap.
                                </div>
                                <button 
                                    className="btn-danger w-full"
                                    onClick={handleFail}
                                    disabled={isSubmitting || !failTaskId}
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                    Fail Task
                                </button>
                            </>
                        )}
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}
