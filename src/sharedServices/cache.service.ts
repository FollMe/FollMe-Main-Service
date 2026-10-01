import { OnModuleInit } from '@nestjs/common';
import { RedisCommandArgument } from '@redis/client/dist/lib/commands';
import { createClient, RedisClientType, RedisDefaultModules, RedisFunctions, RedisScripts } from "redis";



export class CacheService implements OnModuleInit {
  private redis: RedisClientType<RedisDefaultModules, RedisFunctions, RedisScripts>;
  private username = process.env.REDIS_USERNAME;
  private password = process.env.REDIS_PASSWORD;
  private host = process.env.REDIS_HOST;
  private port = process.env.REDIS_PORT;

  public async onModuleInit() {
    // Callers check isReady and degrade without Redis; a failed first
    // connect must not reject unhandled and stop the app.
    this.init().catch(err => console.log('Redis Client Error: ', err));
  }

  private async init() {
    this.redis = await createClient({
      url: `redis://${this.username}:${this.password}@${this.host}:${this.port}`
    })
      .on('error', err => console.log('Redis Client Error: ', err))
      .connect();
  }

  public set(key: RedisCommandArgument, value: number | RedisCommandArgument, duration: number): Promise<string> {
    if (!this.redis?.isReady) {
      throw new Error("Cannot connect to Redis Cloud!");
    }
    return this.redis.set(key, value, {
      "EX": duration
    })
  }

  /** Sets the key only if it does not exist yet; true if it was set. */
  public async setIfAbsent(key: RedisCommandArgument, value: number | RedisCommandArgument, duration: number): Promise<boolean> {
    if (!this.redis?.isReady) {
      throw new Error("Cannot connect to Redis Cloud!");
    }
    const res = await this.redis.set(key, value, { EX: duration, NX: true });
    return res === 'OK';
  }

  /** Increments a counter that expires `duration` seconds after creation. */
  public async incr(key: RedisCommandArgument, duration: number): Promise<number> {
    if (!this.redis?.isReady) {
      throw new Error("Cannot connect to Redis Cloud!");
    }
    const n = await this.redis.incr(key);
    if (n === 1) {
      await this.redis.expire(key, duration);
    }
    return n;
  }

  public get(key: RedisCommandArgument): Promise<string> {
    if (!this.redis?.isReady) {
      throw new Error("Cannot connect to Redis Cloud!");
    }

    return this.redis.get(key);
  }

  public async setJSON(key: string, value: any, duration: number): Promise<string> {
    if (!this.redis?.isReady) {
      return Promise.resolve("NotOK");
    }

    const result = await this.redis.json.set(key, '$', value)
    await this.redis.expire(key, duration);
    return result;
  }

  public getJSON(key: string) {
    if (!this.redis?.isReady) {
      return Promise.resolve(null);
    }

    return this.redis.json.get(key);
  }

  public del(isRestrict: boolean, key: RedisCommandArgument): Promise<number> {
    if (!this.redis?.isReady) {
      if (isRestrict) {
        throw new Error("Cannot connect to Redis Cloud!");
      } else {
        return Promise.resolve(0);
      }
    }

    return this.redis.del(key);
  }
}