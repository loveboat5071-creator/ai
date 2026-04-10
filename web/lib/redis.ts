/**
 * Redis client wrapper with auto-reconnect and one-time retry on closed client errors.
 */

import { createClient } from 'redis';

const REDIS_URL =
  process.env.wsmedia_REDIS_URL ||
  process.env.wsmedia_KV_URL ||
  process.env.REDIS_URL ||
  process.env.KV_URL ||
  '';

const globalForRedis = global as unknown as {
  redisClient?: ReturnType<typeof createClient>;
  redisConnectPromise?: Promise<void> | null;
};

const redisClient =
  globalForRedis.redisClient ||
  createClient({
    url: REDIS_URL,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisClient = redisClient;
}

redisClient.on('error', (err: unknown) => {
  console.error('Redis Client Error', err);
});

function isClosedClientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('The client is closed') ||
    message.includes('Socket closed unexpectedly') ||
    message.includes('ECONNRESET')
  );
}

async function connectIfNeeded(): Promise<void> {
  if (!REDIS_URL) {
    throw new Error('Redis URL is not configured');
  }

  if (redisClient.isOpen) return;

  if (globalForRedis.redisConnectPromise) {
    await globalForRedis.redisConnectPromise;
    return;
  }

  globalForRedis.redisConnectPromise = redisClient
    .connect()
    .then(() => undefined)
    .catch((error) => {
      console.error('Failed to connect Redis', error);
      throw error;
    })
    .finally(() => {
      globalForRedis.redisConnectPromise = null;
    });

  await globalForRedis.redisConnectPromise;
}

async function runRedis<T>(operation: () => Promise<T>): Promise<T> {
  await connectIfNeeded();

  try {
    return await operation();
  } catch (error) {
    if (!isClosedClientError(error)) {
      throw error;
    }

    // Retry once after reconnect for transient closed-client failures.
    try {
      if (redisClient.isOpen) {
        redisClient.disconnect();
      }
    } catch {
      // ignore disconnect failure
    }

    await connectIfNeeded();
    return await operation();
  }
}

export const redis = {
  async get<T>(key: string): Promise<T | null> {
    const value = await runRedis(() => redisClient.get(key));
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },

  async set(key: string, value: unknown, options?: { ex?: number }): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await runRedis(async () => {
      if (options?.ex) {
        await redisClient.setEx(key, options.ex, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
    });
  },

  async del(key: string): Promise<void> {
    await runRedis(() => redisClient.del(key));
  },

  async lPush(key: string, value: string): Promise<void> {
    await runRedis(() => redisClient.lPush(key, value));
  },

  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    return await runRedis(() => redisClient.lRange(key, start, stop));
  },

  async lPop(key: string, count?: number): Promise<string[] | null> {
    const result = await runRedis(async () => {
      if (count && count > 1) {
        const reply = await redisClient.sendCommand(['LPOP', key, String(count)]);
        if (!reply) return null;
        if (Array.isArray(reply)) return reply.map((item) => String(item));
        return [String(reply)];
      }
      return await redisClient.lPop(key);
    });
    if (!result) return null;
    return Array.isArray(result) ? result : [result];
  },

  async lTrim(key: string, start: number, stop: number): Promise<void> {
    await runRedis(() => redisClient.lTrim(key, start, stop));
  },

  async zadd(key: string, options: { score: number; member: string }): Promise<void> {
    await runRedis(() => redisClient.zAdd(key, { score: options.score, value: options.member }));
  },

  async zcard(key: string): Promise<number> {
    return await runRedis(() => redisClient.zCard(key));
  },

  async zRem(key: string, member: string): Promise<void> {
    await runRedis(() => redisClient.zRem(key, member));
  },

  async zrange(
    key: string,
    start: number,
    stop: number,
    options?: { rev?: boolean }
  ): Promise<string[]> {
    if (options?.rev) {
      return await runRedis(() => redisClient.zRange(key, start, stop, { REV: true }));
    }
    return await runRedis(() => redisClient.zRange(key, start, stop));
  },

  async llen(key: string): Promise<number> {
    return await runRedis(() => redisClient.lLen(key));
  },

  async rPush(key: string, value: string): Promise<void> {
    await runRedis(() => redisClient.rPush(key, value));
  },

  async expire(key: string, seconds: number): Promise<void> {
    await runRedis(() => redisClient.expire(key, seconds));
  },

  async zRangeByScore(
    key: string,
    min: number | string,
    max: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]> {
    if (options?.limit) {
      return await runRedis(() =>
        redisClient.zRangeByScore(key, min, max, {
          LIMIT: { offset: options.limit!.offset, count: options.limit!.count },
        })
      );
    }
    return await runRedis(() => redisClient.zRangeByScore(key, min, max));
  },

  async zRevRangeByScore(
    key: string,
    max: number | string,
    min: number | string,
    options?: { limit?: { offset: number; count: number } }
  ): Promise<string[]> {
    return await runRedis(() =>
      redisClient.zRange(key, max, min, {
        BY: 'SCORE',
        REV: true,
        LIMIT: options?.limit
          ? { offset: options.limit.offset, count: options.limit.count }
          : undefined,
      })
    );
  },

  async zRemRangeByScore(key: string, min: number | string, max: number | string): Promise<number> {
    return await runRedis(() => redisClient.zRemRangeByScore(key, min, max));
  },

  pipeline() {
    const commands: Array<() => Promise<void>> = [];

    return {
      set(key: string, value: unknown) {
        commands.push(async () => {
          const serialized = typeof value === 'string' ? value : JSON.stringify(value);
          await redisClient.set(key, serialized);
        });
        return this;
      },

      zadd(key: string, options: { score: number; member: string }) {
        commands.push(async () => {
          await redisClient.zAdd(key, { score: options.score, value: options.member });
        });
        return this;
      },

      zcard(key: string) {
        commands.push(async () => {
          await redisClient.zCard(key);
        });
        return this;
      },

      lpush(key: string, value: string) {
        commands.push(async () => {
          await redisClient.lPush(key, value);
        });
        return this;
      },

      ltrim(key: string, start: number, stop: number) {
        commands.push(async () => {
          await redisClient.lTrim(key, start, stop);
        });
        return this;
      },

      async exec() {
        await runRedis(async () => {
          for (const cmd of commands) {
            await cmd();
          }
        });
      },
    };
  },
};

export type RedisClient = typeof redis;
