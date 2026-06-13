import "server-only";
import path from "node:path";
import { createLogger, format, transports } from "winston";
import Transport from "winston-transport";
import DailyRotateFile from "winston-daily-rotate-file";
import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");

/** Forwards error-level logs to Sentry so log streams and alerts stay in sync. */
class SentryTransport extends Transport {
  log(info: { level: string; message: string; [key: string]: unknown }, callback: () => void) {
    setImmediate(() => this.emit("logged", info));
    if (info.level === "error" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      const extra: Record<string, unknown> = { ...info };
      delete extra.level;
      delete extra.message;
      Sentry.captureMessage(String(info.message), { level: "error", extra });
    }
    callback();
  }
}

const jsonFormat = format.combine(format.timestamp(), format.errors({ stack: true }), format.json());

const devFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: "HH:mm:ss" }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level: lvl, message, ...meta }) => {
    const rest = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${lvl} ${message}${rest}`;
  }),
);

const logDir = path.join(process.cwd(), "logs");

const globalForLogger = globalThis as unknown as { logger?: ReturnType<typeof createLogger> };

export const logger =
  globalForLogger.logger ??
  createLogger({
    level,
    defaultMeta: { service: "dufat-showcase" },
    transports: isProduction
      ? [
          new transports.Console({ format: jsonFormat }),
          new DailyRotateFile({
            dirname: logDir,
            filename: "app-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            maxFiles: "14d",
            format: jsonFormat,
          }),
          new DailyRotateFile({
            dirname: logDir,
            filename: "error-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            level: "error",
            maxFiles: "30d",
            format: jsonFormat,
          }),
          new SentryTransport(),
        ]
      : [new transports.Console({ format: devFormat }), new SentryTransport()],
  });

globalForLogger.logger = logger;
