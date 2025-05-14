import type { LogLevel, LogType } from "./types/types.js";

const logMethods: Record<LogLevel, (msg: string) => void> = {
  error: console.error,
  warn: console.warn,
  info: console.info,
};

export const isDevelopment = () => process.env.NODE_ENV === "development";

const formatLogMessage = (
  message: string,
  timestamp: string,
  type?: LogType
): string => {
  return type
    ? `[${timestamp}][${type}] ${message}`
    : `[${timestamp}] ${message}`;
};

const log = (message: string, level?: LogLevel, type?: LogType) => {
  if (isDevelopment()) {
    const timestamp = new Date().toISOString();
    const logMethod = level ? logMethods[level] || console.log : console.log;
    logMethod(formatLogMessage(message, timestamp, type));

    /* BrowserWindow.getAllWindows().forEach(window => {
      if (window.webContents) {
        window.webContents.send('log', message, timestamp, level, type)
      }
    }) */
  }
};

const roundTo = function (num: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
};

const getId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2);

export { log, roundTo, getId };
