import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string | undefined): string {
  if (!address) return '';
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

export function truncateSignature(sig: string | undefined): string {
  if (!sig) return '';
  return `${sig.slice(0, 8)}...${sig.slice(-4)}`;
}

export function getStatusColor(status: any): string {
  if (!status) return 'text-textSecondary';
  
  if (status.pending) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
  if (status.processing) return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
  if (status.completed) return 'text-green-500 bg-green-500/10 border-green-500/20';
  if (status.failed) return 'text-red-500 bg-red-500/10 border-red-500/20';
  
  return 'text-textSecondary bg-surface border-border';
}

export function getStatusLabel(status: any): string {
  if (!status) return 'Unknown';
  if (status.pending) return 'Pending';
  if (status.processing) return 'Processing';
  if (status.completed) return 'Completed';
  if (status.failed) return 'Failed';
  return 'Unknown';
}
