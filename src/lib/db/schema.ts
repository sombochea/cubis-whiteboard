import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());
const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// ── Better Auth tables ──────────────────────────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestamps,
});

// ── Whiteboard ──────────────────────────────────────────────────────
export const whiteboard = pgTable(
  "whiteboard",
  {
    id: id(),
    title: text("title").notNull().default("Untitled"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    thumbnail: text("thumbnail"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isPublic: boolean("is_public").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("wb_owner_idx").on(t.ownerId), index("wb_title_idx").on(t.title)]
);

// ── Collection ──────────────────────────────────────────────────────
export const collection = pgTable(
  "collection",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#808080"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("col_owner_idx").on(t.ownerId)]
);

export const collectionWhiteboard = pgTable(
  "collection_whiteboard",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    whiteboardId: text("whiteboard_id")
      .notNull()
      .references(() => whiteboard.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.whiteboardId] })]
);

// ── Sharing / Collaborators ─────────────────────────────────────────
export const collaborator = pgTable(
  "collaborator",
  {
    id: id(),
    whiteboardId: text("whiteboard_id")
      .notNull()
      .references(() => whiteboard.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["viewer", "editor"] })
      .notNull()
      .default("viewer"),
    ...timestamps,
  },
  (t) => [
    index("collab_wb_idx").on(t.whiteboardId),
    index("collab_user_idx").on(t.userId),
  ]
);

// ── Personal Library (reusable Excalidraw shapes) ───────────────────
export const library = pgTable("library", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  items: jsonb("items").$type<unknown[]>().notNull().default([]),
  ...timestamps,
});

// ── File uploads ────────────────────────────────────────────────────
export const file = pgTable("file", {
  id: id(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: text("size").notNull(),
  storageKey: text("storage_key").notNull(),
  storageProvider: text("storage_provider", { enum: ["local", "s3"] }).notNull(),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  whiteboardId: text("whiteboard_id").references(() => whiteboard.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});
