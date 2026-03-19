import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const pinoConfig = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
          singleLine: false,
        },
      },
  base: {
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  },
};

export const logger = pino(pinoConfig);

// Structured logging helpers
export const logRequest = (method: string, path: string, userId?: string) => {
  logger.info(
    {
      method,
      path,
      userId,
      timestamp: new Date().toISOString(),
    },
    'API Request'
  );
};

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(
    {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
      timestamp: new Date().toISOString(),
    },
    'Error occurred'
  );
};

export const logDatabaseOperation = (operation: string, table: string, duration: number) => {
  if (duration > 1000) {
    logger.warn(
      {
        operation,
        table,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
      'Slow database operation'
    );
  } else {
    logger.debug(
      {
        operation,
        table,
        durationMs: duration,
      },
      'Database operation'
    );
  }
};
