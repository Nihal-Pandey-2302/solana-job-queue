import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';

export function showTxToast(message: string, signature: string) {
  toast.success(
    (t) => (
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-slate-100">{message}</span>
        <a 
          href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
          onClick={() => toast.dismiss(t.id)}
        >
          View on Solana Explorer ↗
        </a>
      </div>
    ),
    { duration: 5000 }
  );
}
