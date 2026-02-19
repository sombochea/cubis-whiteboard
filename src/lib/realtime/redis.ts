import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    client.on("error", (err) => console.error("[redis]", err.message));
  }
  return client;
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
