import Redis from "ioredis";

export class CacheService {
    public redis: Redis;

    constructor() {
        this.redis = new Redis({
            port: Number(process.env.REDIS_PORT),
            host: process.env.REDIS_HOST,
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: 0
        });
    }

    public get(key: string): Promise<string> {
        if (this.redis.status != 'ready') {
            return undefined;
        }
        return this.redis.get(key);
    }

    public set(key: string, value: string | number | Buffer, duration: number) {
        if (this.redis.status != 'ready') {
            return;
        }
        return this.redis.set(key, value, "EX", duration);
    }
}