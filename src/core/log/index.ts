export type LogLevel = "debug" | "info" | "warn" | "error";

type LogData = Record<string, unknown>;
type LogFn = (message: string, data?: LogData) => void;
export type Logger = Record<LogLevel, LogFn>;

const order: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function shouldLog(level: LogLevel, min: LogLevel): boolean {
  return order[level] >= order[min];
}

function minLevel(): LogLevel {
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function write(level: LogLevel, scope: string, message: string, data?: LogData): void {
  if (!shouldLog(level, minLevel())) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} [${scope}] ${message}`;
  const full = data ? `${line} ${JSON.stringify(data)}` : line;
  if (level === "error") console.error(full);
  else if (level === "warn") console.warn(full);
  else console.log(full);
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, data) => write("debug", scope, message, data),
    info: (message, data) => write("info", scope, message, data),
    warn: (message, data) => write("warn", scope, message, data),
    error: (message, data) => write("error", scope, message, data),
  };
}
