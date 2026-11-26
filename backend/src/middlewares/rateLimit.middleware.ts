import rateLimit, {
  type Options,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { connectRedis, getRedisClient } from "../config/redis";

/*
|--------------------------------------------------------------------------
| Default Rate Limit Configuration
|--------------------------------------------------------------------------
*/

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 300;

class LazyRedisStore extends RedisStore {
  private storeOptions: Options | undefined;

  private initialization: Promise<void> | undefined;

  constructor(prefix: string) {
    super({
      prefix,
      sendCommand: async (command: string, ...args: string[]) =>
        (await getRedisClient().call(command, ...args)) as RedisReply,
    });
  }

  override init(options: Options): Promise<void> {
    this.storeOptions = options;
    this.windowMs = options.windowMs;
    return Promise.resolve();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.storeOptions) {
      throw new Error("Rate-limit Redis store has not been initialized.");
    }

    if (!this.initialization) {
      const options = this.storeOptions;
      this.initialization = connectRedis()
        .then(() => super.init(options))
        .catch((error: unknown) => {
          this.initialization = undefined;
          throw error;
        });
    }

    await this.initialization;
  }

  override async increment(key: string) {
    await this.ensureInitialized();
    return super.increment(key);
  }

  override async get(key: string) {
    await this.ensureInitialized();
    return super.get(key);
  }
}

/*
|--------------------------------------------------------------------------
| Create Rate Limiter
|--------------------------------------------------------------------------
*/

export const createRateLimiter = (
  options: Partial<Options> = {},
  storeName = "custom",
): RateLimitRequestHandler => {
  const { store, ...overrides } = options;

  return rateLimit({
    windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,

    limit: options.limit ?? DEFAULT_MAX_REQUESTS,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
      success: false,
      message: "Too many requests. Please try again later.",
    },

    handler: (req, res, next, options) => {
      res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((options.windowMs ?? DEFAULT_WINDOW_MS) / 1000),
      });
    },

    skip: (req) => {
      /*
       * Health-check endpoints should not consume
       * normal API rate-limit quota.
       */
      return /^\/(?:api\/)?health(?:\/|$)/.test(req.path);
    },

    ...overrides,
    store: store ?? new LazyRedisStore(`noptrix:rate-limit:${storeName}:`),
  });
};

/*
|--------------------------------------------------------------------------
| Global API Limiter
|--------------------------------------------------------------------------
*/

export const globalRateLimiter = createRateLimiter(
  {
    windowMs: 15 * 60 * 1000,
    // Shared Codespaces proxy IPs and dashboard polling need a larger API quota.
    limit: 5000,
  },
  "global",
);

/*
|--------------------------------------------------------------------------
| Authentication Limiter
|--------------------------------------------------------------------------
|
| Used for:
| - Login
| - Register
| - Password reset
| - Sensitive authentication endpoints
|
*/

export const authRateLimiter = createRateLimiter(
  {
    windowMs: 15 * 60 * 1000,
    limit: 20,

    message: {
      success: false,
      message: "Too many authentication attempts. Please try again later.",
    },
  },
  "auth",
);

/*
|--------------------------------------------------------------------------
| OTP Limiter
|--------------------------------------------------------------------------
|
| OTP endpoints need much stricter protection.
|
*/

export const otpRateLimiter = createRateLimiter(
  {
    windowMs: 10 * 60 * 1000,
    limit: 5,

    message: {
      success: false,
      message: "Too many OTP requests. Please wait before trying again.",
    },
  },
  "otp",
);

/*
|--------------------------------------------------------------------------
| Admin Sensitive Action Limiter
|--------------------------------------------------------------------------
*/

export const adminActionRateLimiter = createRateLimiter(
  {
    windowMs: 15 * 60 * 1000,
    limit: 60,

    message: {
      success: false,
      message: "Too many administrative requests. Please try again later.",
    },
  },
  "admin-action",
);
