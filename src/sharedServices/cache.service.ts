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
    this.init();
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
    this.redis.expire(key, duration);
    return Promise.resolve(result);
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