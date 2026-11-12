/** AllDog voice agent — request bodies of /book and /details (zod). Field limits match the lead columns. */
import { z } from "zod";

const text = (max: number) => z.string().max(max).nullish();

export const voiceLeadSchema = z.object({
  conversationId: z.string().trim().min(1).max(200),
  callerPhone: text(50),
  callbackPhone: text(50),
  externalCallId: text(200),
  fullName: text(200),
  dogName: text(200),
  breed: text(200),
  age: text(100),
  city: text(200),
  problem: text(2000),
  urgent: z.boolean().nullish(),
  urgentReason: text(1000),
});

export const voiceBookSchema = voiceLeadSchema.extend({
  startsAt: z.string().trim().min(1).max(40),
});
