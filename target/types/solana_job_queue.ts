/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solana_job_queue.json`.
 */
export type SolanaJobQueue = {
  "address": "CADUfHFQg6ywjsUbkzdFxVgQ7Hh7bN2YPgxS5QBjeX4n",
  "metadata": {
    "name": "solanaJobQueue",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "On-chain multi-tenant job queue — a Web2 backend pattern rebuilt on Solana"
  },
  "docs": [
    "The Solana Job Queue program — a Web2 backend pattern rebuilt on-chain."
  ],
  "instructions": [
    {
      "name": "closeTask",
      "docs": [
        "Queue authority closes a finished task to reclaim rent.",
        "",
        "Equivalent to cleaning up processed messages — but on Solana, you get SOL back."
      ],
      "discriminator": [
        55,
        234,
        77,
        69,
        245,
        208,
        54,
        167
      ],
      "accounts": [
        {
          "name": "task",
          "writable": true
        },
        {
          "name": "queue"
        },
        {
          "name": "authority",
          "docs": [
            "The queue authority who receives the reclaimed rent."
          ],
          "writable": true,
          "signer": true,
          "relations": [
            "queue"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "completeTask",
      "docs": [
        "Worker marks a task as completed with a result payload.",
        "",
        "Equivalent to `sqs.delete_message()` after successful processing."
      ],
      "discriminator": [
        109,
        167,
        192,
        41,
        129,
        108,
        220,
        196
      ],
      "accounts": [
        {
          "name": "task",
          "writable": true
        },
        {
          "name": "queue",
          "writable": true
        },
        {
          "name": "worker",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  111,
                  114,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "queue"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "worker"
          ]
        }
      ],
      "args": [
        {
          "name": "result",
          "type": "string"
        }
      ]
    },
    {
      "name": "deregisterWorker",
      "docs": [
        "Deactivates a worker (soft-delete preserving stats).",
        "",
        "Equivalent to gracefully shutting down a Celery worker."
      ],
      "discriminator": [
        169,
        158,
        198,
        70,
        128,
        77,
        176,
        167
      ],
      "accounts": [
        {
          "name": "worker",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  111,
                  114,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "queue"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "queue",
          "relations": [
            "worker"
          ]
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "worker"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "enqueueTask",
      "docs": [
        "Enqueues a new task with payload, priority, and optional scheduled execution.",
        "",
        "Equivalent to `celery.send_task()` or `sqs.send_message()`."
      ],
      "discriminator": [
        13,
        0,
        14,
        183,
        191,
        229,
        17,
        111
      ],
      "accounts": [
        {
          "name": "task",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "queue"
              },
              {
                "kind": "account",
                "path": "queue.total_tasks",
                "account": "queue"
              }
            ]
          }
        },
        {
          "name": "queue",
          "writable": true
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "payload",
          "type": "string"
        },
        {
          "name": "priority",
          "type": "u8"
        },
        {
          "name": "executeAfter",
          "type": "i64"
        },
        {
          "name": "dependsOn",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "failTask",
      "docs": [
        "Worker reports task failure. Auto-requeues if retries remain.",
        "",
        "Equivalent to `rabbitmq.basic_nack(requeue=True)` or SQS visibility timeout retry."
      ],
      "discriminator": [
        233,
        192,
        3,
        196,
        234,
        73,
        55,
        84
      ],
      "accounts": [
        {
          "name": "task",
          "writable": true
        },
        {
          "name": "queue",
          "writable": true
        },
        {
          "name": "worker",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  111,
                  114,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "queue"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "worker"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeQueue",
      "docs": [
        "Creates a new task queue with the given name and retry policy.",
        "",
        "Equivalent to `aws sqs create-queue` or `redis XGROUP CREATE`."
      ],
      "discriminator": [
        174,
        102,
        132,
        232,
        90,
        202,
        27,
        20
      ],
      "accounts": [
        {
          "name": "queue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  101,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "arg",
                "path": "name"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "maxRetries",
          "type": "u8"
        }
      ]
    },
    {
      "name": "processTask",
      "docs": [
        "Worker claims a pending task for processing.",
        "",
        "Equivalent to `sqs.receive_message()` or `redis BRPOPLPUSH`.",
        "Solana's runtime provides free concurrency control via account write-locks."
      ],
      "discriminator": [
        115,
        15,
        34,
        43,
        144,
        232,
        190,
        144
      ],
      "accounts": [
        {
          "name": "task",
          "writable": true
        },
        {
          "name": "queue",
          "writable": true
        },
        {
          "name": "worker",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  111,
                  114,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "queue"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "worker"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "registerWorker",
      "docs": [
        "Registers a worker to consume tasks from a queue.",
        "",
        "Equivalent to starting a Celery worker or an SQS consumer."
      ],
      "discriminator": [
        22,
        253,
        23,
        225,
        230,
        31,
        6,
        192
      ],
      "accounts": [
        {
          "name": "worker",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  111,
                  114,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "queue"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "queue",
          "docs": [
            "The queue this worker will serve."
          ]
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "queue",
      "discriminator": [
        204,
        167,
        6,
        247,
        20,
        33,
        2,
        188
      ]
    },
    {
      "name": "task",
      "discriminator": [
        79,
        34,
        229,
        55,
        88,
        90,
        55,
        84
      ]
    },
    {
      "name": "worker",
      "discriminator": [
        224,
        158,
        97,
        5,
        224,
        241,
        67,
        146
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "queueNameTooLong",
      "msg": "Queue name must be 32 characters or fewer"
    },
    {
      "code": 6001,
      "name": "payloadTooLong",
      "msg": "Task payload must be 512 bytes or fewer"
    },
    {
      "code": 6002,
      "name": "resultTooLong",
      "msg": "Task result must be 512 bytes or fewer"
    },
    {
      "code": 6003,
      "name": "taskNotPending",
      "msg": "Task is not in Pending status"
    },
    {
      "code": 6004,
      "name": "taskNotProcessing",
      "msg": "Task is not in Processing status"
    },
    {
      "code": 6005,
      "name": "unauthorizedWorker",
      "msg": "Only the assigned worker can complete or fail this task"
    },
    {
      "code": 6006,
      "name": "workerNotActive",
      "msg": "Worker is not active"
    },
    {
      "code": 6007,
      "name": "maxRetriesExceeded",
      "msg": "Task has exceeded maximum retry attempts"
    },
    {
      "code": 6008,
      "name": "taskNotFinished",
      "msg": "Only completed or failed tasks can be closed"
    },
    {
      "code": 6009,
      "name": "taskNotYetScheduled",
      "msg": "Task is scheduled for future execution and cannot be processed yet"
    },
    {
      "code": 6010,
      "name": "invalidPriority",
      "msg": "Invalid priority value"
    },
    {
      "code": 6011,
      "name": "taskQueueMismatch",
      "msg": "Task does not belong to this queue"
    },
    {
      "code": 6012,
      "name": "workerQueueMismatch",
      "msg": "Worker does not belong to this queue"
    },
    {
      "code": 6013,
      "name": "queueCapacityExceeded",
      "msg": "Queue priority heap capacity exceeded (max 256)"
    },
    {
      "code": 6014,
      "name": "dependencyNotMet",
      "msg": "Prerequisite dependency task is not Completed"
    },
    {
      "code": 6015,
      "name": "invalidDependencyPda",
      "msg": "Invalid or missing dependency task PDA"
    }
  ],
  "types": [
    {
      "name": "heapItem",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "taskId",
            "type": "u64"
          },
          {
            "name": "priority",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "queue",
      "docs": [
        "A multi-tenant task queue — the top-level organizational unit.",
        "",
        "Each queue is owned by an `authority` and identified by a human-readable `name`.",
        "PDA seeds: `[b\"queue\", authority.key(), name.as_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "The wallet that created and owns this queue."
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "Human-readable name for the queue (max 32 bytes)."
            ],
            "type": "string"
          },
          {
            "name": "totalTasks",
            "docs": [
              "Auto-incrementing counter used to assign sequential task IDs."
            ],
            "type": "u64"
          },
          {
            "name": "pendingCount",
            "docs": [
              "Number of tasks currently in `Pending` status."
            ],
            "type": "u64"
          },
          {
            "name": "processingCount",
            "docs": [
              "Number of tasks currently in `Processing` status."
            ],
            "type": "u64"
          },
          {
            "name": "completedCount",
            "docs": [
              "Number of tasks in `Completed` status."
            ],
            "type": "u64"
          },
          {
            "name": "failedCount",
            "docs": [
              "Number of tasks in `Failed` status (after all retries exhausted)."
            ],
            "type": "u64"
          },
          {
            "name": "maxRetries",
            "docs": [
              "Default maximum retry attempts for tasks in this queue."
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when this queue was created."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          },
          {
            "name": "priorityHeap",
            "docs": [
              "On-chain priority max-heap for O(log n) task processing order"
            ],
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "heapItem"
                  }
                },
                64
              ]
            }
          },
          {
            "name": "heapSize",
            "docs": [
              "Current number of items in the heap"
            ],
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "task",
      "docs": [
        "A single task within a queue — the core work unit.",
        "",
        "Models a unit of work with payload, priority, scheduling, and lifecycle tracking.",
        "PDA seeds: `[b\"task\", queue.key(), &task_id.to_le_bytes()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "queue",
            "docs": [
              "The parent queue this task belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "taskId",
            "docs": [
              "Sequential task ID within the queue."
            ],
            "type": "u64"
          },
          {
            "name": "creator",
            "docs": [
              "The wallet that enqueued this task (producer)."
            ],
            "type": "pubkey"
          },
          {
            "name": "worker",
            "docs": [
              "The worker currently processing this task (if any)."
            ],
            "type": "pubkey"
          },
          {
            "name": "status",
            "docs": [
              "Current lifecycle status of the task."
            ],
            "type": {
              "defined": {
                "name": "taskStatus"
              }
            }
          },
          {
            "name": "priority",
            "docs": [
              "Priority level (0-255). Higher values = higher priority.",
              "Workers should process higher-priority tasks first."
            ],
            "type": "u8"
          },
          {
            "name": "payload",
            "docs": [
              "Task payload — typically a JSON-encoded work description."
            ],
            "type": "string"
          },
          {
            "name": "result",
            "docs": [
              "Result data — populated when the task is completed."
            ],
            "type": "string"
          },
          {
            "name": "retryCount",
            "docs": [
              "How many times this task has been retried after failure."
            ],
            "type": "u8"
          },
          {
            "name": "maxRetries",
            "docs": [
              "Maximum number of retries allowed for this task."
            ],
            "type": "u8"
          },
          {
            "name": "executeAfter",
            "docs": [
              "Optional: earliest Unix timestamp at which this task should be processed.",
              "Workers should skip tasks where `execute_after > current_time`."
            ],
            "type": "i64"
          },
          {
            "name": "dependsOn",
            "docs": [
              "Optional: task_id of a prerequisite task that must be Completed first."
            ],
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when the task was enqueued."
            ],
            "type": "i64"
          },
          {
            "name": "startedAt",
            "docs": [
              "Unix timestamp when a worker started processing (0 if not yet started)."
            ],
            "type": "i64"
          },
          {
            "name": "completedAt",
            "docs": [
              "Unix timestamp when the task was completed or permanently failed (0 if not yet)."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "taskStatus",
      "docs": [
        "Represents the status of a task in the queue.",
        "Models a deterministic state machine with well-defined transitions:",
        "Pending → Processing → Completed",
        "→ Failed → Pending (if retries remain)"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "processing"
          },
          {
            "name": "completed"
          },
          {
            "name": "failed"
          }
        ]
      }
    },
    {
      "name": "worker",
      "docs": [
        "A registered worker for a specific queue.",
        "",
        "Workers must register before they can process tasks.",
        "PDA seeds: `[b\"worker\", queue.key(), authority.key()]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "queue",
            "docs": [
              "The queue this worker is registered with."
            ],
            "type": "pubkey"
          },
          {
            "name": "authority",
            "docs": [
              "The wallet that controls this worker."
            ],
            "type": "pubkey"
          },
          {
            "name": "tasksCompleted",
            "docs": [
              "Lifetime count of tasks successfully completed by this worker."
            ],
            "type": "u64"
          },
          {
            "name": "tasksFailed",
            "docs": [
              "Lifetime count of tasks failed by this worker."
            ],
            "type": "u64"
          },
          {
            "name": "isActive",
            "docs": [
              "Whether this worker is currently active and can accept tasks."
            ],
            "type": "bool"
          },
          {
            "name": "registeredAt",
            "docs": [
              "Unix timestamp when this worker registered."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
