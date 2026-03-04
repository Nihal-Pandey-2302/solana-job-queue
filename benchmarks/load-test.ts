import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaJobQueue } from "../target/types/solana_job_queue";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runBenchmark() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.SolanaJobQueue as Program<SolanaJobQueue>;
    const authority = provider.wallet;
    
    const workerKeypairs = Array.from({ length: 5 }, () => Keypair.generate());
    const QUEUE_NAME = "perf-queue-" + Date.now().toString().slice(-4);

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

    console.log("🚀 Starting Production Load Benchmark");
    console.log("Target: Local Validator (Devnet baseline)");
    console.log("---");

    // 1. Setup
    console.log("Funding workers and initializing...");
    for (const keypair of workerKeypairs) {
        const sig = await provider.connection.requestAirdrop(keypair.publicKey, anchor.web3.LAMPORTS_PER_SOL);
        await provider.connection.confirmTransaction(sig, "confirmed");
    }

    await program.methods.initializeQueue(QUEUE_NAME, 3).accounts({
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
    }).rpc();

    for (const keypair of workerKeypairs) {
        await program.methods.registerWorker().accounts({
            queue: queuePda,
            authority: keypair.publicKey,
            systemProgram: SystemProgram.programId,
        }).signers([keypair]).rpc();
    }

    // Benchmark 1: Enqueue Throughput
    const NUM_TASKS = 200;
    console.log(`\n📦 Benchmark 1: Enqueuing ${NUM_TASKS} Tasks...`);
    const enqueueStart = Date.now();
    const enqueuePromises = [];

    // Note: To avoid rate-limiting node locally, we batch them in groups of 10
    for (let i = 0; i < NUM_TASKS; i += 10) {
        const batch = [];
        for (let j = 0; j < 10 && i + j < NUM_TASKS; j++) {
            batch.push(
                program.methods
                    .enqueueTask(`payload-${i+j}`, 10, new anchor.BN(0), null)
                    .accounts({
                        queue: queuePda,
                        creator: authority.publicKey,
                        systemProgram: SystemProgram.programId,
                    }).rpc()
            );
        }
        await Promise.all(batch);
    }
    const enqueueEnd = Date.now();
    const enqueueDuration = (enqueueEnd - enqueueStart) / 1000;
    const enqueueTps = NUM_TASKS / enqueueDuration;
    console.log(`✅ Result: ${enqueueTps.toFixed(2)} Enqueue TPS (${enqueueDuration.toFixed(2)}s)`);

    // Benchmark 2: Concurrent Processing Throughput
    console.log(`\n⚙️  Benchmark 2: Concurrent Fast-Processing ${NUM_TASKS} Tasks...`);
    const processStart = Date.now();
    
    // We have 5 workers, let's have them cycle through grabbing tasks
    let processedCount = 0;
    const processPromises = [];
    
    for (let i = 0; i < NUM_TASKS; i++) {
        const workerKeypair = workerKeypairs[i % workerKeypairs.length];
        const [taskPda] = getTaskPda(queuePda, i);
        
        processPromises.push(
            program.methods.processTask().accounts({
                task: taskPda,
                queue: queuePda,
                authority: workerKeypair.publicKey,
            }).signers([workerKeypair]).rpc()
            .then(() => program.methods.completeTask("success").accounts({
                task: taskPda,
                queue: queuePda,
                authority: workerKeypair.publicKey,
            }).signers([workerKeypair]).rpc())
            .then(() => { processedCount++; })
            .catch(e => {
                // If collision happens, expected in high concurrency
            })
        );
        
        if (processPromises.length >= 20) {
            await Promise.all(processPromises);
            processPromises.length = 0;
        }
    }
    
    if (processPromises.length > 0) {
        await Promise.all(processPromises);
    }

    const processEnd = Date.now();
    const processDuration = (processEnd - processStart) / 1000;
    const processTps = processedCount / processDuration;
    
    console.log(`✅ Result: ${processTps.toFixed(2)} Process/Complete TPS (${processDuration.toFixed(2)}s)`);
    console.log(`Total deeply executed: ${processedCount}/${NUM_TASKS}`);
    
    console.log("\n📊 Benchmark Metrics Output:");
    console.log("-----------------------------------------");
    console.log(`Average Enqueue Latency:  ${(enqueueDuration * 1000 / NUM_TASKS).toFixed(2)} ms`);
    console.log(`Average Execution Latency: ${(processDuration * 1000 / processedCount).toFixed(2)} ms`);
    console.log("-----------------------------------------");
}

runBenchmark().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
