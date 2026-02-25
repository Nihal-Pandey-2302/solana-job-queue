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
  if (fs.existsSync("./deploy-keypair.json")) {
    console.log("1️⃣ Using local deploy-keypair.json...");
    walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync("./deploy-keypair.json", "utf8"))));
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
      console.error("   ❌ Airdrop failed (likely rate-limited). Please fund the address above and run again.");
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
  const initTx = await program.methods
    .initializeQueue(queueName, 3)
    .accounts({
      queue: queuePda,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("   ✅ Queue Created! TX:", initTx);

  const [workerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("worker"), queuePda.toBuffer(), wallet.publicKey.toBuffer()],
    programId
  );

  console.log("\n4️⃣ Registering Worker...");
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

  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(BigInt(0));
  const [taskPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("task"), queuePda.toBuffer(), taskIdBuffer],
    programId
  );

  console.log("\n5️⃣ Enqueuing Task (Payload: Email alert)...");
  const enqueueTx = await program.methods
    .enqueueTask('{"type":"email_alert","user":"admin"}', 100, new anchor.BN(0))
    .accounts({
      task: taskPda,
      queue: queuePda,
      creator: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("   ✅ Task Enqueued! TX:", enqueueTx);

  console.log("\n6️⃣ Worker Claiming & Processing Task...");
  const processTx = await program.methods
    .processTask()
    .accounts({
      task: taskPda,
      queue: queuePda,
      worker: workerPda,
      authority: wallet.publicKey,
    })
    .rpc();
  console.log("   ✅ Task Claimed! TX:", processTx);

  console.log("\n7️⃣ Completing Task & Processing Result...");
  const completeTx = await program.methods
    .completeTask('{"status":"delivered","id":"msg_123"}')
    .accounts({
      task: taskPda,
      queue: queuePda,
      worker: workerPda,
      authority: wallet.publicKey,
    })
    .rpc();
  console.log("   ✅ Task Completed! TX:", completeTx);

  console.log("\n🎉 DEMO COMPLETE! All on-chain operations succeeded.");
  console.log("You can verify any of the above TX hashes on https://explorer.solana.com/?cluster=devnet");
}

run().catch(console.error);
