import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";

let connection: Redis | null = null;

const getConnection = (): Redis => {
  if (!connection) {
    connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
};

export const QUEUE_NAMES = {
  EMBEDDING: "embedding",
  MEETING_PROCESSOR: "meeting-processor",
  AUTOMATION_EXECUTOR: "automation-executor",
  NOTIFICATION: "notification",
  IMPORT: "import",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queues = new Map<QueueName, Queue>();

export const getQueue = (name: QueueName): Queue => {
  const existing = queues.get(name);
  if (existing) return existing;
  const queue = new Queue(name, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
  queues.set(name, queue);
  return queue;
};

export const createWorker = <T>(
  name: QueueName,
  processor: (job: Job<T>) => Promise<void>,
): Worker<T> =>
  new Worker<T>(name, processor, {
    connection: getConnection(),
    concurrency: 5,
  });
