import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaJobQueue } from "../target/types/solana_job_queue";
import { assert } from "chai";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";

describe("Heap Invariant Fuzzing", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaJobQueue as Program<SolanaJobQueue>;
  const authority = provider.wallet;
  const workerKeypair = Keypair.generate();

  const QUEUE_NAME = "fuzz-queue-" + Math.floor(Math.random() * 1000);
  
  const getQueuePda = (auth: PublicKey, name: string) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("queue"), auth.toBuffer(), Buffer.from(name)],
      program.programId
    );
  };

  const getWorkerPda = (queueKey: PublicKey, workerAuth: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("worker"), queueKey.toBuffer(), workerAuth.toBuffer()],
      program.programId
    );
  };
  
  const getTaskPda = (queueKey: PublicKey, taskId: number) => {
    const taskIdBuffer = Buffer.alloc(8);
    taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("task"), queueKey.toBuffer(), taskIdBuffer],
      program.programId
    );
  };

  const [queuePda] = getQueuePda(authority.publicKey, QUEUE_NAME);
  const [workerPda] = getWorkerPda(queuePda, workerKeypair.publicKey);

  before(async () => {
    // 1. Airdrop
    await provider.connection.requestAirdrop(
      workerKeypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    ).then((sig) => provider.connection.confirmTransaction(sig, "confirmed"));

    // 2. Initialize Queue
    await program.methods
      .initializeQueue(QUEUE_NAME, 3)
      .accounts({
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // 3. Register Worker
    await program.methods
      .registerWorker()
      .accounts({
        queue: queuePda,
        authority: workerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([workerKeypair])
      .rpc();
  });

  it("maintains max-heap property with 50 random priorities", async () => {
    const NUM_TASKS = 50;
    const priorities = Array.from({ length: NUM_TASKS }, () => 
      Math.floor(Math.random() * 256)
    );

    console.log("Enqueueing tasks with priorities:", priorities.join(", "));

    // 1. Enqueue all 50 tasks
    for (let i = 0; i < NUM_TASKS; i++) {
        await program.methods
            .enqueueTask(`fuzz-${i}`, priorities[i], new anchor.BN(0), null)
            .accounts({
                queue: queuePda,
                creator: authority.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }

    // 2. Process all 50 tasks sequentially and capture their priorities
    const processedTasks = [];
    
    for (let i = 0; i < NUM_TASKS; i++) {
        // Fetch queue state to see the root of the heap
        const queueState = await program.account.queue.fetch(queuePda);
        const topTask = queueState.priorityHeap[0];
        const taskId = topTask.taskId.toNumber();
        const [taskPda] = getTaskPda(queuePda, taskId);
        
        await program.methods
            .processTask()
            .accounts({
                task: taskPda,
                queue: queuePda,
                authority: workerKeypair.publicKey,
            })
            .signers([workerKeypair])
            .rpc();
            
        const processedState = await program.account.task.fetch(taskPda);
        processedTasks.push(processedState.priority);
    }

    console.log("Processed priorities (should be descending):", processedTasks.join(", "));

    // 3. Verify max-heap property: each item is >= next item
    for (let i = 0; i < NUM_TASKS - 1; i++) {
      assert.isAtLeast(
        processedTasks[i], 
        processedTasks[i + 1],
        `Heap violated at index ${i}: ${processedTasks[i]} !>= ${processedTasks[i+1]}`
      );
    }
  });

});
