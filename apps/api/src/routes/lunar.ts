import { Router } from "express";
import { z } from "zod";
import {
  solarToLunar,
  lunarToSolar,
  getLunarHolidayName,
  getSolarHolidayName,
} from "@luna/lunar-calendar";

export const lunarRouter = Router();

const querySchema = z.object({
  day: z.coerce.number().int(),
  month: z.coerce.number().int(),
  year: z.coerce.number().int(),
  direction: z.enum(["solar2lunar", "lunar2solar"]),
  leap: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

// GET /lunar/convert?day=&month=&year=&direction=solar2lunar|lunar2solar[&leap=true]
// Exposes @luna/lunar-calendar's conversion directly, for non-JS clients and debugging.
lunarRouter.get("/convert", (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { day, month, year, direction, leap } = parsed.data;

  if (direction === "solar2lunar") {
    const lunar = solarToLunar(day, month, year);
    res.json({
      ...lunar,
      holidayName: getLunarHolidayName(lunar.month, lunar.day),
    });
    return;
  }

  const solar = lunarToSolar(day, month, year, leap ?? false);
  res.json({
    ...solar,
    holidayName: getSolarHolidayName(solar.month, solar.day),
  });
});
