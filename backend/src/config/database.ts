import mongoose, { type ConnectOptions, type Connection } from "mongoose";

import { env } from "./env";
import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Database Connection State
|--------------------------------------------------------------------------
*/

let isDatabaseConnected = false;

let connectionPromise: Promise<void> | null = null;

/*
|--------------------------------------------------------------------------
| Database Connection Options
|--------------------------------------------------------------------------
*/

const databaseOptions: ConnectOptions = {
  dbName: env.MONGODB_DB_NAME,

  /*
    |--------------------------------------------------------------------------
    | Connection Pool
    |--------------------------------------------------------------------------
    */

  maxPoolSize: 20,
  minPoolSize: 5,

  /*
    |--------------------------------------------------------------------------
    | Connection Timeouts
    |--------------------------------------------------------------------------
    */

  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,

  /*
    |--------------------------------------------------------------------------
    | MongoDB Write Behaviour
    |--------------------------------------------------------------------------
    */

  retryWrites: true,

  /*
    |--------------------------------------------------------------------------
    | IPv4
    |--------------------------------------------------------------------------
    */

  family: 4,
};

/*
|--------------------------------------------------------------------------
| Database Connection
|--------------------------------------------------------------------------
*/

const databaseConnection: Connection = mongoose.connection;

async function assertTransactionSupport(): Promise<void> {
  const database = databaseConnection.db;

  if (!database) {
    throw new Error("MongoDB connected without an active database handle.");
  }

  const topology = await database.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid") {
    throw new Error(
      "MongoDB transactions require a replica set or sharded cluster. Configure MONGODB_URI to connect to one.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Connect Database
|--------------------------------------------------------------------------
*/

export const connectDatabase = async (): Promise<void> => {
  /*
        |--------------------------------------------------------------------------
        | Already Connected
        |--------------------------------------------------------------------------
        */

  if (isDatabaseConnected || databaseConnection.readyState === 1) {
    await assertTransactionSupport();
    isDatabaseConnected = true;

    logger.debug("MongoDB connection already established.");

    return;
  }

  /*
        |--------------------------------------------------------------------------
        | Reuse Existing Connection Attempt
        |--------------------------------------------------------------------------
        |
        | Prevents multiple parts of the application from
        | opening simultaneous MongoDB connections.
        |
        |--------------------------------------------------------------------------
        */

  if (connectionPromise) {
    return connectionPromise;
  }

  /*
        |--------------------------------------------------------------------------
        | Create Connection Attempt
        |--------------------------------------------------------------------------
        */

  connectionPromise = mongoose
    .connect(env.MONGODB_URI, databaseOptions)
    .then(async () => {
      await assertTransactionSupport();
      isDatabaseConnected = true;

      logger.info(
        {
          database: env.MONGODB_DB_NAME,
        },
        "MongoDB connected successfully.",
      );
    })
    .catch((error) => {
      isDatabaseConnected = false;

      logger.error(
        {
          error,
        },
        "MongoDB connection failed.",
      );

      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};

/*
|--------------------------------------------------------------------------
| Disconnect Database
|--------------------------------------------------------------------------
*/

export const disconnectDatabase = async (): Promise<void> => {
  /*
        |--------------------------------------------------------------------------
        | Nothing To Disconnect
        |--------------------------------------------------------------------------
        */

  if (!isDatabaseConnected && databaseConnection.readyState === 0) {
    return;
  }

  /*
        |--------------------------------------------------------------------------
        | Wait For Active Connection Attempt
        |--------------------------------------------------------------------------
        */

  if (connectionPromise) {
    try {
      await connectionPromise;
    } catch {
      /*
                |--------------------------------------------------------------------------
                | Connection failed.
                |
                | Continue shutdown safely.
                |--------------------------------------------------------------------------
                */
    }
  }

  try {
    await mongoose.disconnect();

    isDatabaseConnected = false;

    logger.info("MongoDB disconnected successfully.");
  } catch (error) {
    logger.error(
      {
        error,
      },
      "MongoDB disconnection failed.",
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Database Ready State
|--------------------------------------------------------------------------
*/

export const isDatabaseHealthy = (): boolean => {
  return databaseConnection.readyState === 1;
};

/*
|--------------------------------------------------------------------------
| Database Connection State
|--------------------------------------------------------------------------
|
| Mongoose readyState:
|
| 0 = disconnected
| 1 = connected
| 2 = connecting
| 3 = disconnecting
|
|--------------------------------------------------------------------------
*/

export const getDatabaseState = (): {
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  disconnected: boolean;
  readyState: number;
  database: string;
} => {
  const readyState = databaseConnection.readyState;

  return {
    connected: readyState === 1,

    connecting: readyState === 2,

    disconnecting: readyState === 3,

    disconnected: readyState === 0,

    readyState,

    database: env.MONGODB_DB_NAME,
  };
};

/*
|--------------------------------------------------------------------------
| MongoDB Connection Metadata
|--------------------------------------------------------------------------
*/

export const getDatabaseConnection = (): Connection => {
  return databaseConnection;
};

/*
|--------------------------------------------------------------------------
| MongoDB Event Listeners
|--------------------------------------------------------------------------
*/

databaseConnection.on("connecting", () => {
  logger.info("MongoDB connection attempt started.");
});

databaseConnection.on("connected", () => {
  isDatabaseConnected = true;

  logger.info(
    {
      database: env.MONGODB_DB_NAME,
    },
    "MongoDB connection established.",
  );
});

databaseConnection.on("disconnected", () => {
  isDatabaseConnected = false;

  logger.warn("MongoDB connection lost.");
});

databaseConnection.on("reconnected", () => {
  isDatabaseConnected = true;

  logger.info("MongoDB connection restored.");
});

databaseConnection.on("error", (error) => {
  isDatabaseConnected = false;

  logger.error(
    {
      error,
    },
    "MongoDB connection error.",
  );
});

/*
|--------------------------------------------------------------------------
| MongoDB Process Warning
|--------------------------------------------------------------------------
*/

databaseConnection.on("fullsetup", () => {
  logger.info("MongoDB replica set connection is fully established.");
});
