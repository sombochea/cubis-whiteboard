import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_OPTS = { lazyConnect: true, maxRetriesPerRequest: 1 } as const;

let client: Redis | null = null;
let pub: Redis | null = null;
let sub: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(REDIS_URL, REDIS_OPTS);
    client.on("error", (err) => console.error("[redis]", err.message));
  }
  return client;
}

/** Dedicated pub/sub clients for the Socket.IO Redis adapter. */
export function getPubSubClients(): { pub: Redis; sub: Redis } {
  if (!pub) {
    pub = new Redis(REDIS_URL, REDIS_OPTS);
    pub.on("error", (err) => console.error("[redis:pub]", err.message));
  }
  if (!sub) {
    sub = pub.duplicate();
    sub.on("error", (err) => console.error("[redis:sub]", err.message));
  }
  return { pub, sub };
}

const ROOM_KEY = (roomId: string) => `room:${roomId}`;
const TTL = 86400; // 24h safety expiry

export type RoomUser = { userId: string; name: string; color: string };

export async function addRoomUser(roomId: string, socketId: string, user: RoomUser) {
  const r = getRedis();
  await r.hset(ROOM_KEY(roomId), socketId, JSON.stringify(user));
  await r.expire(ROOM_KEY(roomId), TTL);
}

export async function removeRoomUser(roomId: string, socketId: string) {
  const r = getRedis();
  await r.hdel(ROOM_KEY(roomId), socketId);
}

export async function getRoomUsers(roomId: string): Promise<RoomUser[]> {
  const r = getRedis();
  const raw = await r.hvals(ROOM_KEY(roomId));
  return raw.map((v) => JSON.parse(v) as RoomUser);
}

export async function getRoomSize(roomId: string): Promise<number> {
  return getRedis().hlen(ROOM_KEY(roomId));
}

export async function clearRoom(roomId: string) {
  await getRedis().del(ROOM_KEY(roomId));
}
