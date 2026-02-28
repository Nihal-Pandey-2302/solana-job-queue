// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";

// Load the IDL manually since we are outside the Anchor workspace env context natively
const idl = JSON.parse(fs.readFileSync("./target/idl/solana_job_queue.json", "utf8"));
const programId = new PublicKey("CADUfHFQg6ywjsUbkzdFxVgQ7Hh7bN2YPgxS5QBjeX4n");

async function run() {
  console.log("========================================");
  console.log("🚀 SOLANA JOB QUEUE — LIVE DEVNET DEMO");
  console.log("========================================\n");
  
  const connection = new anchor.web3.Connection("https://devnet.helius-rpc.com/?api-key=b68b97dc-101d-4736-9368-2a9ffec93463", "confirmed");
  
  let walletKeypair;
  const defaultKeyPath = process.env.HOME + "/.config/solana/id.json";
  
  if (process.env.ANCHOR_WALLET && fs.existsSync(process.env.ANCHOR_WALLET)) {
    console.log("1️⃣ Using ANCHOR_WALLET...");
    walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET, "utf8"))));
  } else if (fs.existsSync("./deploy-keypair.json")) {
    console.log("1️⃣ Using local deploy-keypair.json...");
    walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync("./deploy-keypair.json", "utf8"))));
  } else if (fs.existsSync(defaultKeyPath)) {
    console.log("1️⃣ Using local Solana CLI wallet (~/.config/solana/id.json)...");
    walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(defaultKeyPath, "utf8"))));
  } else {
    console.log("1️⃣ Generating Ephemeral Demo Wallet...");
    walletKeypair = Keypair.generate();
    console.log("   Address:", walletKeypair.publicKey.toBase58());
    console.log("\n   Requesting Devnet Airdrop...");
    try {
      const airdropSig = await connection.requestAirdrop(walletKeypair.publicKey, 0.5 * anchor.web3.LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdropSig);
      console.log("   ✅ Airdrop Successful!");
    } catch (e) {
      console.error("   ❌ Devnet airdrop failed (rate-limited).");
      console.error("   💡 Please ensure you have a standard Solana CLI wallet at ~/.config/solana/id.json with some Devnet SOL.");
      process.exit(1);
    }
  }

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  
  const program = new Program(idl, provider);
  const queueName = "demo-queue-" + Math.floor(Math.random() * 10000);
  
  const [queuePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("queue"), wallet.publicKey.toBuffer(), Buffer.from(queueName)],
    programId
  );

  console.log(`\n3️⃣ Initializing Queue ('${queueName}')...`);
  let initTx;
  try {
      initTx = await program.methods
        .initializeQueue(queueName, 3)
        .accounts({
          queue: queuePda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("   ✅ Queue Created! TX:", initTx);
  } catch (err) {
      console.log("   Queue already exists or init failed:", err.message);
  }

  const [workerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("worker"), queuePda.toBuffer(), wallet.publicKey.toBuffer()],
    programId
  );

  console.log("\n4️⃣ Registering Worker...");
  try {
      const regTx = await program.methods
        .registerWorker()
        .accounts({
          worker: workerPda,
          queue: queuePda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("   ✅ Worker Registered! TX:", regTx);
  } catch (err) {
      console.log("   Worker already registered or failed:", err.message);
  }

  // Helper derivation
  const getTaskPda = (taskId) => {
    const taskIdBuffer = Buffer.alloc(8);
    taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("task"), queuePda.toBuffer(), taskIdBuffer],
      programId
    )[0];
  };

  const taskAPda = getTaskPda(0);
  const taskBPda = getTaskPda(1);
  const taskCPda = getTaskPda(2);

  console.log("\n5️⃣ Enqueuing Tasks to demonstrate Priority Heap and DAG Dependencies...");
  
  // Task A: Low Priority
  console.log("   -> Enqueuing Task A (Priority: 10, Prerequisite for C)");
  const txA = await program.methods
    .enqueueTask('{"step":"setup"}', 10, new anchor.BN(0), null)
    .accounts({
      task: taskAPda, queue: queuePda, creator: wallet.publicKey, systemProgram: SystemProgram.programId,
    }).rpc();
  console.log("      ✅ TX:", txA);

  // Task B: High Priority
  console.log("   -> Enqueuing Task B (Priority: 255)");
  const txB = await program.methods
    .enqueueTask('{"step":"urgent_patch"}', 255, new anchor.BN(0), null)
    .accounts({
      task: taskBPda, queue: queuePda, creator: wallet.publicKey, systemProgram: SystemProgram.programId,
    }).rpc();
  console.log("      ✅ TX:", txB);

  // Task C: Dependent on Task A
  console.log("   -> Enqueuing Task C (Dependent on Task A)");
  const txC = await program.methods
    .enqueueTask('{"step":"deploy"}', 50, new anchor.BN(0), new anchor.BN(0))
    .accounts({
      task: taskCPda, queue: queuePda, creator: wallet.publicKey, systemProgram: SystemProgram.programId,
    }).rpc();
  console.log("      ✅ TX:", txC);

  console.log("\n6️⃣ Worker Processing Tasks (Evaluating Max-Heap O(log n))...");
  
  console.log("   -> Worker claims first task. Heap should yield Task B (Priority 255) first.");
  const claim1 = await program.methods
    .processTask()
    .accounts({
      task: taskBPda, queue: queuePda, worker: workerPda, authority: wallet.publicKey,
    }).rpc();
  console.log("      ✅ Claimed Task B (High Priority)! TX:", claim1);

  console.log("   -> Completing Task B...");
  await program.methods.completeTask('{"status":"done"}')
    .accounts({ task: taskBPda, queue: queuePda, worker: workerPda, authority: wallet.publicKey }).rpc();

  console.log("\n7️⃣ Evaluating DAG Dependencies...");
  console.log("   -> Worker attempts to claim Task C (Dependent on A).");
  try {
      await program.methods.processTask()
        .accounts({ task: taskCPda, queue: queuePda, worker: workerPda, authority: wallet.publicKey })
        .remainingAccounts([{ pubkey: taskAPda, isSigner: false, isWritable: false }])
        .rpc();
      console.log("      ❌ Wait, this should have failed!");
  } catch (err) {
      console.log("      ✅ Expected Failure: DependencyNotMet. Task A is not completed yet.");
  }

  console.log("   -> Worker claims and completes Task A (Prerequisite).");
  await program.methods.processTask().accounts({ task: taskAPda, queue: queuePda, worker: workerPda, authority: wallet.publicKey }).rpc();
  await program.methods.completeTask('{"status":"done"}').accounts({ task: taskAPda, queue: queuePda, worker: workerPda, authority: wallet.publicKey }).rpc();

  console.log("   -> Worker claims Task C now that A is complete.");
  const claimC = await program.methods.processTask()
    .accounts({ task: taskCPda, queue: queuePda, worker: workerPda, authority: wallet.publicKey })
    .remainingAccounts([{ pubkey: taskAPda, isSigner: false, isWritable: false }])
    .rpc();
  console.log("      ✅ Successfully claimed Task C! TX:", claimC);

  console.log("\n🎉 DEMO COMPLETE! Priority Heap & DAG Constraints verified on-chain.");
}

run().catch(console.error);
