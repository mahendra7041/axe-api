import { createClient } from "redis";
import { ICacheAdaptor } from "../../Interfaces";
import { LogService } from "../../Services";
import { AppLoader } from "src/AppLoader";

type RedisClientType = ReturnType<typeof createClient>;

class RedisAdaptor implements ICacheAdaptor {
  private client: RedisClientType;
  private prefix: string = "";
  private isConnected: boolean;

  constructor() {
    const appLoader = AppLoader.getInstance();
    const options = appLoader.map.config?.redis || {};
    this.client = createClient(options);
    this.isConnected = false;
  }

  isReady() {
    return this.isConnected;
  }

  async connect() {
    try {
      await this.client.connect();
      this.client.on("error", (err) => {
        LogService.error(`Redis Client Error: ${err.message}`);
      });
      LogService.info("Redis connection done!");
      this.isConnected = true;
    } catch (error: any) {
      LogService.error(`Redis Connection Error: ${error.message}`);
    }
  }

  async get(key: string) {
    return await this.client.get(`${this.prefix}${key}`);
  }

  async set(key: string, value: string, ttl: number) {
    await this.client.setEx(`${this.prefix}${key}`, ttl, value);
  }

  async tags(keys: string[], value: string) {
    keys.forEach((key) => {
      this.client.sAdd(key, [value]);
    });
  }

  async getTagMembers(tag: string) {
    return await this.client.sMembers(tag);
  }

  async delete(keys: string[]) {
    return await this.client.del(keys);
  }

  async decr(key: string) {
    await this.client.decr(`${this.prefix}${key}`);
  }

  async searchTags(pattern: string) {
    return await this.client.scan(0, {
      MATCH: pattern,
    });
  }
}

export default RedisAdaptor;
