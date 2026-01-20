import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum, index, real } from "drizzle-orm/pg-core";

export const callStatusEnum = pgEnum("call_status", [
  "pending",
  "calling",
  "completed",
  "failed",
  "no_answer",
]);

export const intentEnum = pgEnum("intent", ["hot", "warm", "cold"]);

export const companySizeEnum = pgEnum("company_size", [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
]);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Contact Information
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    company: varchar("company", { length: 255 }).notNull(),
    role: varchar("role", { length: 100 }),
    companySize: companySizeEnum("company_size"),
    initialRequest: text("initial_request").notNull(),

    // Call Information
    callId: varchar("call_id", { length: 255 }),
    callStatus: callStatusEnum("call_status").notNull().default("pending"),
    callDuration: integer("call_duration"),
    callStartedAt: timestamp("call_started_at", { withTimezone: true }),
    callEndedAt: timestamp("call_ended_at", { withTimezone: true }),

    // Qualification Fields
    motivation: text("motivation"),
    timeline: varchar("timeline", { length: 100 }),
    budget: varchar("budget", { length: 100 }),
    authority: varchar("authority", { length: 100 }),
    pastExperience: text("past_experience"),

    // Classification
    intent: intentEnum("intent"),
    qualificationScore: real("qualification_score"),

    // Call Transcript
    transcript: text("transcript"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("leads_email_idx").on(table.email),
    index("leads_call_status_idx").on(table.callStatus),
    index("leads_intent_idx").on(table.intent),
    index("leads_created_at_idx").on(table.createdAt),
    index("leads_deleted_at_idx").on(table.deletedAt),
    index("leads_qualification_score_idx").on(table.qualificationScore),
  ]
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
