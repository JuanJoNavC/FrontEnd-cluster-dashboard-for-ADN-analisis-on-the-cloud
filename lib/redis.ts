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
    lazyConnect: true,
    // Reconectar siempre: cuando el túnel SSH se caiga y vuelva, Redis también vuelve
    retryStrategy: (times) => Math.min(times * 300, 3000),
  });

  if (process.env.NODE_ENV !== "production") {
    client.on("connect", () => console.log("[redis] Conectado"));
    client.on("error", (err) => {
      // Solo loguear el primer error, no el spam de reconexiones
      if ((client as Redis & { _errCount?: number })._errCount === undefined) {
        (client as Redis & { _errCount?: number })._errCount = 0;
      }
      const c = client as Redis & { _errCount: number };
      if (c._errCount === 0) console.warn("[redis] Sin conexión:", err.message);
      c._errCount++;
    });
  } else {
    client.on("error", () => {}); // silenciar en prod (Vercel tiene sus propios logs)
  }

  return client;
}

// Singleton: reutilizar conexión entre hot-reloads en desarrollo
const redis: Redis =
  globalThis.__redisClient ?? (globalThis.__redisClient = createRedisClient());

export default redis;
