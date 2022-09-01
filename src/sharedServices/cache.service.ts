import Redis from "ioredis";

export class CacheService {
    public redis: Redis;

    constructor() {
        this.redis = new Redis({
            port: Number(process.env.REDIS_PORT),
            host: process.env.REDIS_HOST,
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
        });
    }
}