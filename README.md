# 🔗 Solana Job Queue

**A traditional backend job queue - rebuilt entirely on-chain as a Solana program.**

> _Demonstrating how Web2 patterns like Redis Queue, Celery, AWS SQS, and RabbitMQ can be redesigned using Solana's account model and runtime guarantees._

<a href="https://anchor-lang.com" target="_blank"><img src="https://img.shields.io/badge/Built%20with-Anchor-blue" alt="Built with Anchor" /></a>
<a href="https://explorer.solana.com" target="_blank"><img src="https://img.shields.io/badge/Deployed-Devnet-green" alt="Solana Devnet" /></a>
<a href="https://opensource.org/licenses/MIT" target="_blank"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>

---

## 📖 Overview

Job queues are everywhere in backend engineering - they power email delivery, webhook processing, notification systems, background data pipelines, and scheduled tasks. This project rebuilds the core logic of a production job queue as a **Solana on-chain program**, demonstrating how familiar Web2 patterns translate to blockchain architecture.

### Key Features

- 🏢 **Multi-Tenant Queues** - Isolated queue instances per authority (like separate SQS queues)
- 📨 **Task Lifecycle** - Full state machine: Pending → Processing → Completed/Failed
- 🔄 **Automatic Retries** - Failed tasks re-queue up to N times (like Dead Letter Queues)
- ⏰ **Scheduled Execution** - Tasks with `execute_after` timestamps (like SQS DelaySeconds)
- ⚡ **Priority Levels** - 0-255 priority range for task ordering
- 👷 **Worker Registry** - On-chain worker registration with performance tracking
- 🔒 **Access Control** - Only registered, active workers can process tasks
- 💰 **Rent Reclamation** - Close finished tasks to get SOL back

---

## 🏗️ Architecture: Web2 vs Solana

### How Job Queues Work in Web2

```
┌─────────────┐     ┌───────────────────┐     ┌──────────────┐
│  Producer   │────▶│  Message Broker   │────▶│  Consumer    │
│  (API/Cron) │     │  (Redis/SQS/RMQ)  │     │  (Worker)    │
└─────────────┘     └───────────────────┘     └──────┬───────┘
                                                     │
                    ┌───────────────────┐            │
                    │  Result Backend   │◀───────────┘
                    │  (Redis/Postgres) │
                    └───────────────────┘
```

| Component       | Implementation                                                 |
| --------------- | -------------------------------------------------------------- |
| **State**       | Stored in Redis/PostgreSQL (mutable rows/keys)                 |
| **Concurrency** | Distributed locks (`SETNX`), `BRPOPLPUSH`, visibility timeouts |
| **Ordering**    | FIFO lists, sorted sets, priority queues                       |
| **Auth**        | API keys, IAM roles, service mesh mTLS                         |
| **Retry**       | Exponential backoff, DLQ routing, `maxReceiveCount`            |
| **Cleanup**     | TTL-based expiry, cron-based garbage collection                |

### How This Works on Solana

```
┌─────────────┐     ┌──────────────────────────────────┐     ┌──────────────┐
│  Producer   │────▶│  Solana Program (on-chain)       │────▶│  Worker      │
│  (TX signer)│     │  ┌────────┐  ┌────────────────┐  │     │  (TX signer) │
└─────────────┘     │  │Queue   │  │Task Accounts   │  │     └──────┬───────┘
                    │  │(PDA)   │  │(PDAs)          │  │            │
                    │  └────────┘  └────────────────┘  │     Results stored
                    │  ┌────────────────────────────┐  │     in Task PDA
                    │  │ State Machine Constraints  │  │
                    │  └────────────────────────────┘  │
                    └──────────────────────────────────┘
```

| Component       | Implementation                                                      |
| --------------- | ------------------------------------------------------------------- |
| **State**       | PDA accounts - each task is a separate account                      |
| **Concurrency** | Solana runtime's account write-locks (FREE - no distributed locks!) |
| **Ordering**    | Sequential task IDs + priority field per task                       |
| **Auth**        | PDA ownership + `Signer` constraints + `has_one` checks             |
| **Retry**       | `retry_count` / `max_retries` → automatic re-queue to Pending       |
| **Cleanup**     | `close_task` reclaims rent (economic incentive, not just cleanup)   |

### Tradeoffs & Constraints

| Aspect           | Web2 Advantage              | Solana Advantage                                                |
| ---------------- | --------------------------- | --------------------------------------------------------------- |
| **Throughput**   | Redis: ~100K ops/sec        | Solana: ~400 TPS per account (but parallelizable across queues) |
| **Latency**      | Sub-millisecond (in-memory) | ~400ms (block confirmation)                                     |
| **Data Size**    | Unlimited (disk/memory)     | Task payload capped at 512 bytes (account size limits)          |
| **Cost**         | Server/instance costs       | ~0.002 SOL/task (rent, reclaimable)                             |
| **Durability**   | Requires replication config | Automatic - blockchain is immutable by default                  |
| **Auditability** | Custom logging/monitoring   | Free - every state change is a public, signed transaction       |
| **Trust**        | Trust the operator          | Trustless - program logic is verifiable on-chain                |
| **Concurrency**  | Manual distributed locks    | Free - runtime account-locking prevents race conditions         |

---

## 🏆 Architectural Highlights (Judging Focus)

To explicitly address the Superteam bounty criteria, this program avoids common Web2-to-Solana anti-patterns:

1. **No 10MB Account Limit Bottlenecks:** Instead of storing a `Vec<Task>` inside a single Queue account (which limits queue size and causes heavy serial write contention), _every single task is its own isolated PDA_. This allows theoretically infinite queue scalability and massively parallel processing.
2. **Rent as Garbage Collection:** In Web2, processed messages are deleted or TTL-expired to save database space. On Solana, the `close_task` instruction allows the queue authority to delete the task PDA and **reclaim the SOL rent deposit**. This converts a traditional operational chore (DB cleanup) into an economic incentive.
3. **Cost-Free Concurrency & DLQs:** We don't need distributed system locks (e.g., Redis `SETNX`). Solana's runtime inherently locks accounts being written to, making double-processing impossible. Failing tasks simply decrement a `retry_count` until they hit a permanent `Failed` state, mirroring Dead Letter Queue (DLQ) functionality natively.

---

## 📐 Account Model

```mermaid
graph TD
    A["Queue PDA"] --> B["Task PDA"]
    A --> C["Worker PDA"]

    B --> D["TaskStatus Enum"]
    D --> E["Pending"]
    D --> F["Processing"]
    D --> G["Completed"]
    D --> H["Failed"]
```

## 🔄 State Machine

```mermaid
stateDiagram-v2
    [*] --> Pending: enqueue_task
    Pending --> Processing: process_task (worker claims)
    Processing --> Completed: complete_task (with result)
    Processing --> Pending: fail_task (retries remain)
    Processing --> Failed: fail_task (retries exhausted)
    Completed --> [*]: close_task (rent reclaimed)
    Failed --> [*]: close_task (rent reclaimed)
```

---

## 🚀 Quick Start & Live Deployment

**Solana Devnet Program ID:**
<a href="https://explorer.solana.com/address/CADUfHFQg6ywjsUbkzdFxVgQ7Hh7bN2YPgxS5QBjeX4n?cluster=devnet" target="_blank" rel="noopener noreferrer">`CADUfHFQg6ywjsUbkzdFxVgQ7Hh7bN2YPgxS5QBjeX4n`</a>

**Devnet Transaction Proofs:**

1. <a href="https://explorer.solana.com/tx/5wWxariPDxHjANQhGg2G5fXe84qHmDdGvhy7u7pq4Mq6k7rFVvCs9pAkVvs6Ew27xkVukY44Nybn3auAomhrA55J?cluster=devnet" target="_blank" rel="noopener noreferrer">Initialize Queue</a>
2. <a href="https://explorer.solana.com/tx/4YP3C8Vza6f4FZ6QWSbjyXyhKJuovZM4MohZoXDSy3tWDVT416ct3D2Ep1t6mvrGMtSUU1RjoHdv5hFdMmAsfU7q?cluster=devnet" target="_blank" rel="noopener noreferrer">Register Worker</a>
3. <a href="https://explorer.solana.com/tx/4L3zTro4Ds9HnBFt6PgdpANcSw7DYAskGPejeFewuwyMCdjjkKL71FSZE2xG6TMEy6zvWBvsyNnVR5KU62myswJC?cluster=devnet" target="_blank" rel="noopener noreferrer">Enqueue Task</a>
4. <a href="https://explorer.solana.com/tx/499D2DkYBjSxeUWjgWn68gekC1r3anQnwKeLd1DpRi3LxuyLMqBqR4bMibWTnRAvGSFBmyyxADKVY9qGcWHZ9Ca2?cluster=devnet" target="_blank" rel="noopener noreferrer">Process Task</a>
5. <a href="https://explorer.solana.com/tx/5hnKHrDmQzydkPKqdc7MsxSHZhXyoujnie9LhYeKBnXLf7AoJi4HcEaRXk7z8N2xVwwYm1gUnkXGEwaMwFvJHwQ6?cluster=devnet" target="_blank" rel="noopener noreferrer">Complete Task</a>

### Prerequisites

- <a href="https://rustup.rs/" target="_blank" rel="noopener noreferrer">Rust</a> (1.75+)
- <a href="https://docs.solana.com/cli/install-solana-cli-tools" target="_blank" rel="noopener noreferrer">Solana CLI</a> (v1.18+)
- <a href="https://www.anchor-lang.com/docs/installation" target="_blank" rel="noopener noreferrer">Anchor</a> (v0.30+)
- <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">Node.js</a> (v18+)

### Build & Test

```bash
# Clone the repo
git clone https://github.com/Nihal-Pandey-2302/solana-job-queue.git
cd solana-job-queue

# Install dependencies
npm install

# Build the Solana program
anchor build

# Run the test suite (starts local validator automatically)
anchor test
```

### 🎬 One-Click Live Demo

Want to see it in action immediately without setting up local wallets? Run the automated Devnet demo!

```bash
# This will generate an ephemeral wallet, grab Devnet SOL, and execute a full Task Lifecycle
npm run demo
```

### Deploy to Devnet

```bash
# Configure for Devnet
solana config set --url devnet

# Create a keypair (if you don't have one)
solana-keygen new

# Airdrop SOL for deployment
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet

# Note the Program ID from the output and update Anchor.toml + lib.rs
```

---

## 💻 CLI Client

The CLI provides a complete interface for all on-chain operations.

### Setup

```bash
cd cli
npm install
```

### Usage Examples

```bash
# Use -c flag for cluster: localnet (default), devnet, mainnet
CLI="npx ts-node src/index.ts -c devnet"

# 1. Create a queue
$CLI create-queue --name "email-jobs" --max-retries 3

# 2. Register as a worker
$CLI register-worker --queue <QUEUE_ADDRESS>

# 3. Enqueue tasks with priority
$CLI enqueue --queue <QUEUE_ADDRESS> \
  --payload '{"type":"email","to":"user@example.com","subject":"Welcome!"}' \
  --priority 200

# 4. Enqueue a scheduled task (execute after 60 seconds)
$CLI enqueue --queue <QUEUE_ADDRESS> \
  --payload '{"type":"reminder","message":"Follow up"}' \
  --delay 60

# 5. Process (claim) a task
$CLI process --queue <QUEUE_ADDRESS> --task-id 0

# 6. Complete with result
$CLI complete --queue <QUEUE_ADDRESS> --task-id 0 \
  --result '{"status":"sent","messageId":"msg_abc123"}'

# 7. View queue status
$CLI status --queue <QUEUE_ADDRESS>

# 8. Inspect a specific task
$CLI inspect --queue <QUEUE_ADDRESS> --task-id 0

# 9. List all tasks (with optional status filter)
$CLI list-tasks --queue <QUEUE_ADDRESS> --status pending

# 10. Close finished task (reclaim rent)
$CLI close-task --queue <QUEUE_ADDRESS> --task-id 0
```

### Sample Output - Queue Status

```
╔══════════════════════════════════════════════════╗
║          SOLANA JOB QUEUE - STATUS               ║
╠══════════════════════════════════════════════════╣
║  Queue:        email-jobs                        ║
║  Max Retries:  3                                 ║
╠══════════════════════════════════════════════════╣
║  📊 Task Statistics                              ║
║  Total Tasks:  5                                 ║
║  ⏳ Pending:    2                                ║
║  ⚙️  Processing: 1                               ║
║  ✅ Completed:  1                                ║
║  ❌ Failed:     1                                ║
╚══════════════════════════════════════════════════╝
```

---

## 🧪 Testing

The test suite covers 17 scenarios across 5 categories:

| Category             | Tests | What's Verified                                                            |
| -------------------- | ----- | -------------------------------------------------------------------------- |
| Queue Management     | 2     | Creation, name validation                                                  |
| Worker Management    | 3     | Registration, deregistration (soft-delete)                                 |
| Happy Path Lifecycle | 5     | Enqueue → Process → Complete → Close, rent reclamation                     |
| Failure & Retry      | 4     | Retry 1/3, 2/3, 3/3 (dead letter), close failed                            |
| Scheduled Tasks      | 2     | Future scheduling, premature process rejection                             |
| Access Control       | 4     | Inactive worker, unauthorized worker, non-closable pending, payload limits |
| Multi-Tenant         | 2     | Separate queues, same-name different authority                             |

```bash
# Run tests
anchor test

# Expected output:
# solana-job-queue
#   Queue Management
#     ✓ initializes a queue
#     ✓ rejects queue names longer than 32 characters
#   Worker Management
#     ✓ registers a worker
#     ✓ registers a second worker
#     ✓ deregisters a worker (soft-delete)
#   Task Lifecycle - Happy Path
#     ✓ enqueues a task with priority and payload
#     ✓ enqueues a second task with higher priority
#     ✓ worker processes (claims) a pending task
#     ✓ worker completes a task with result
#     ✓ authority closes a completed task and reclaims rent
#   Task Lifecycle - Failure & Retry
#     ✓ worker processes → fails → task is re-queued (retry 1/3)
#     ✓ retry 2/3 - fails again, re-queued
#     ✓ retry 3/3 - fails permanently (dead letter)
#     ✓ can close a permanently failed task
#   Scheduled Tasks
#     ✓ enqueues a task with future execute_after
#     ✓ rejects processing a task before its scheduled time
#   Access Control & Edge Cases
#     ✓ rejects processing by a deactivated worker
#     ✓ rejects completing a task by wrong worker
#     ✓ rejects closing a pending/processing task
#     ✓ rejects payloads exceeding 512 bytes
#   Multi-Tenant Isolation
#     ✓ creates a second queue with a different name
#     ✓ different users can create queues with the same name
```

---

## 🔗 Devnet Deployment

**Program ID:** `CADUfHFQg6ywjsUbkzdFxVgQ7Hh7bN2YPgxS5QBjeX4n`

### Transaction Links

| Operation       | Transaction                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy Program  | <a href="https://explorer.solana.com/address/CADUfHFQg6ywjsUbkzdFxVgQ7Hh7bN2YPgxS5QBjeX4n?cluster=devnet" target="_blank" rel="noopener noreferrer">View on Explorer</a>                                        |
| Create Queue    | <a href="https://explorer.solana.com/tx/5wWxariPDxHjANQhGg2G5fXe84qHmDdGvhy7u7pq4Mq6k7rFVvCs9pAkVvs6Ew27xkVukY44Nybn3auAomhrA55J?cluster=devnet" target="_blank" rel="noopener noreferrer">View on Explorer</a> |
| Register Worker | <a href="https://explorer.solana.com/tx/4YP3C8Vza6f4FZ6QWSbjyXyhKJuovZM4MohZoXDSy3tWDVT416ct3D2Ep1t6mvrGMtSUU1RjoHdv5hFdMmAsfU7q?cluster=devnet" target="_blank" rel="noopener noreferrer">View on Explorer</a> |
| Enqueue Task    | <a href="https://explorer.solana.com/tx/4L3zTro4Ds9HnBFt6PgdpANcSw7DYAskGPejeFewuwyMCdjjkKL71FSZE2xG6TMEy6zvWBvsyNnVR5KU62myswJC?cluster=devnet" target="_blank" rel="noopener noreferrer">View on Explorer</a> |
| Process Task    | <a href="https://explorer.solana.com/tx/499D2DkYBjSxeUWjgWn68gekC1r3anQnwKeLd1DpRi3LxuyLMqBqR4bMibWTnRAvGSFBmyyxADKVY9qGcWHZ9Ca2?cluster=devnet" target="_blank" rel="noopener noreferrer">View on Explorer</a> |
| Complete Task   | <a href="https://explorer.solana.com/tx/5hnKHrDmQzydkPKqdc7MsxSHZhXyoujnie9LhYeKBnXLf7AoJi4HcEaRXk7z8N2xVwwYm1gUnkXGEwaMwFvJHwQ6?cluster=devnet" target="_blank" rel="noopener noreferrer">View on Explorer</a> |

---

## 📁 Project Structure

```
solana-job-queue/
├── programs/
│   └── solana-job-queue/
│       └── src/
│           ├── lib.rs                 # Program entry point (8 handlers)
│           ├── state.rs               # Account structs & enums
│           ├── errors.rs              # Custom error types
│           └── instructions/
│               ├── mod.rs             # Module re-exports
│               ├── initialize_queue.rs
│               ├── register_worker.rs
│               ├── deregister_worker.rs
│               ├── enqueue_task.rs
│               ├── process_task.rs
│               ├── complete_task.rs
│               ├── fail_task.rs
│               └── close_task.rs
├── tests/
│   └── solana-job-queue.ts            # 17 integration tests
├── cli/
│   └── src/
│       └── index.ts                   # CLI client (10 commands)
├── ARCHITECTURE.md                    # Deep-dive Web2 → Solana analysis
├── Anchor.toml
├── Cargo.toml
└── package.json
```

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

Built for the <a href="https://superteam.fun/earn/listing/rebuild-production-backend-systems-as-on-chain-rust-programs" target="_blank" rel="noopener noreferrer">Superteam Poland "Rebuild Backend Systems as On-Chain Rust Programs"</a> challenge. This project aims to demonstrate that Solana is not just a cryptocurrency platform - it's a **distributed state machine backend** capable of running traditional infrastructure patterns with stronger guarantees around atomicity, auditability, and trust.
