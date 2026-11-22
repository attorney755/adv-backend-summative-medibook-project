'use strict';

/**
 * Redis Client Configuration (Part E)
 * 
 * In this module, I configured the Redis connection using the official 'redis' package.
 * It reads configuration from environment variables (REDIS_HOST, REDIS_PORT)
 * and provides a shared client instance for the web server and background workers.
 */

require('dotenv').config();
const { createClient } = require('redis');

// First, I read the Redis connection parameters from environment variables
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;
const redisUrl = `redis://${redisHost}:${redisPort}`;

// Next, I instantiated the Redis client with automatic reconnect handling
const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => {
  console.error('[Redis Client Error]', err.message);
});

redisClient.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Redis] Connected successfully to ${redisUrl}`);
  }
});

/**
 * Helper to ensure the client is connected before executing commands.
 */
async function getConnectedRedisClient() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

module.exports = {
  redisClient,
  getConnectedRedisClient,
};
