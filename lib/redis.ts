import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | undefined;
}

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    lazyConnect: false,
  });

  client.on("connect", () => {
    console.log("[redis] Conectado a Redis");
  });

  client.on("error", (err) => {
    console.error("[redis] Error de conexión:", err.message);
  });

  client.on("close", () => {
    console.warn("[redis] Conexión cerrada");
  });

  return client;
}

// Singleton: reutilizar conexión entre hot-reloads en desarrollo
const redis: Redis =
  globalThis.__redisClient ?? (globalThis.__redisClient = createRedisClient());

export default redis;
