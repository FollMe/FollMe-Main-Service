import Redis from "ioredis";

export class CacheService {
    public redis: Redis;
    
    constructor() {
        this.redis = new Redis();
    }
}