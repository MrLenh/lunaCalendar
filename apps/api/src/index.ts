import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { authRouter } from "./routes/auth";
import { eventsRouter } from "./routes/events";
import { accountsRouter } from "./routes/accounts";
import { contactsRouter } from "./routes/contacts";
import { syncRouter } from "./routes/sync";
import { lunarRouter } from "./routes/lunar";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/sync", syncRouter);
app.use("/api/lunar", lunarRouter);

// Basic error handler for anything an individual route didn't already catch.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Luna Calendar API listening on http://localhost:${PORT}`);
});

export { app };
