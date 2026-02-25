//! # Solana Job Queue
//!
//! A multi-tenant on-chain job queue that demonstrates how traditional Web2
//! backend patterns (Redis Queue, Celery, AWS SQS, RabbitMQ) can be rebuilt
//! as a Solana program using Anchor.
//!
//! ## Architecture
//!
//! The program models a distributed task queue with three core entity types:
//!
//! - **Queue**: A named, tenant-isolated container for tasks (like an SQS queue or Redis stream)
//! - **Task**: A unit of work with payload, priority, scheduling, and lifecycle tracking
//! - **Worker**: A registered consumer authorized to process tasks from a queue
//!
//! ## State Machine
//!
//! Tasks follow a deterministic lifecycle:
//!
//! ```text
//! Pending ──(process)──▶ Processing ──(complete)──▶ Completed
//!    ▲                       │
//!    │                  (fail + retries remain)
//!    └───────────────────────┘
//!                            │
//!                       (fail + no retries)
//!                            │
//!                            ▼
//!                          Failed
//! ```
//!
//! ## Key Design Decisions
//!
//! 1. **PDAs as message store**: Each task is a separate PDA, enabling individual
//!    addressability without table scans (vs. Redis lists/streams).
//!
//! 2. **Runtime concurrency control**: Solana's account write-locking prevents
//!    double-processing without distributed locks (vs. Redis BRPOPLPUSH).
//!
//! 3. **Rent as economic incentive**: Task accounts require rent deposits,
//!    reclaimable on close — incentivizing cleanup (vs. TTL-based expiry in Redis).
//!
//! 4. **On-chain result storage**: Results are stored in the task PDA itself,
//!    providing permanent, publicly verifiable output (vs. ephemeral result backends).

use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("CADUfHFQg6ywjsUbkzdFxVgQ7Hh7bN2YPgxS5QBjeX4n");

/// The Solana Job Queue program — a Web2 backend pattern rebuilt on-chain.
#[program]
pub mod solana_job_queue {
    use super::*;

    /// Creates a new task queue with the given name and retry policy.
    ///
    /// Equivalent to `aws sqs create-queue` or `redis XGROUP CREATE`.
    pub fn initialize_queue(
        ctx: Context<InitializeQueue>,
        name: String,
        max_retries: u8,
    ) -> Result<()> {
        instructions::initialize_queue::handler(ctx, name, max_retries)
    }

    /// Registers a worker to consume tasks from a queue.
    ///
    /// Equivalent to starting a Celery worker or an SQS consumer.
    pub fn register_worker(ctx: Context<RegisterWorker>) -> Result<()> {
        instructions::register_worker::handler(ctx)
    }

    /// Deactivates a worker (soft-delete preserving stats).
    ///
    /// Equivalent to gracefully shutting down a Celery worker.
    pub fn deregister_worker(ctx: Context<DeregisterWorker>) -> Result<()> {
        instructions::deregister_worker::handler(ctx)
    }

    /// Enqueues a new task with payload, priority, and optional scheduled execution.
    ///
    /// Equivalent to `celery.send_task()` or `sqs.send_message()`.
    pub fn enqueue_task(
        ctx: Context<EnqueueTask>,
        payload: String,
        priority: u8,
        execute_after: i64,
    ) -> Result<()> {
        instructions::enqueue_task::handler(ctx, payload, priority, execute_after)
    }

    /// Worker claims a pending task for processing.
    ///
    /// Equivalent to `sqs.receive_message()` or `redis BRPOPLPUSH`.
    /// Solana's runtime provides free concurrency control via account write-locks.
    pub fn process_task(ctx: Context<ProcessTask>) -> Result<()> {
        instructions::process_task::handler(ctx)
    }

    /// Worker marks a task as completed with a result payload.
    ///
    /// Equivalent to `sqs.delete_message()` after successful processing.
    pub fn complete_task(ctx: Context<CompleteTask>, result: String) -> Result<()> {
        instructions::complete_task::handler(ctx, result)
    }

    /// Worker reports task failure. Auto-requeues if retries remain.
    ///
    /// Equivalent to `rabbitmq.basic_nack(requeue=True)` or SQS visibility timeout retry.
    pub fn fail_task(ctx: Context<FailTask>) -> Result<()> {
        instructions::fail_task::handler(ctx)
    }

    /// Queue authority closes a finished task to reclaim rent.
    ///
    /// Equivalent to cleaning up processed messages — but on Solana, you get SOL back.
    pub fn close_task(ctx: Context<CloseTask>) -> Result<()> {
        instructions::close_task::handler(ctx)
    }
}
