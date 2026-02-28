import { Program, AnchorProvider, type Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../idl.json';
import type { SolanaJobQueue } from '../solana_job_queue';

// Hardcoded for Vercel deployment as requested
export const PROGRAM_ID = new PublicKey('CADUfHFQg6ywjsUbkzdFxVgQ7Hh7bN2YPgxS5QBjeX4n');
export const DEVNET_URL = 'https://api.devnet.solana.com';

export const getConnection = () => new Connection(DEVNET_URL, 'confirmed');

export const getProgram = (provider: AnchorProvider) => {
  return new Program(idl as Idl, provider) as unknown as Program<SolanaJobQueue>;
};

// PDAs
export const getQueuePda = (authority: PublicKey, name: string) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('queue'), authority.toBuffer(), Buffer.from(name)],
    PROGRAM_ID
  );
};

export const getWorkerPda = (queue: PublicKey, workerAuthority: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('worker'), queue.toBuffer(), workerAuthority.toBuffer()],
    PROGRAM_ID
  );
};

export const getTaskPda = (queue: PublicKey, taskId: anchor.BN | number | bigint) => {
  // Convert to 8-byte LE buffer
  let buf = Buffer.alloc(8);
  if (typeof taskId === 'number' || typeof taskId === 'bigint') {
      buf.writeBigUInt64LE(BigInt(taskId));
  } else {
      buf = (taskId as anchor.BN).toArrayLike(Buffer as any, 'le', 8) as any;
  }
  return PublicKey.findProgramAddressSync(
    [Buffer.from('task'), queue.toBuffer(), buf],
    PROGRAM_ID
  );
};
