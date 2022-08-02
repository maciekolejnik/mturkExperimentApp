const Queue = require("bull");
const redis = require('redis');

const HEROKU_REDIS_URL =
  process.env.REDIS_TLS_URL || process.env.REDIS_URL;
const REDIS_URL = HEROKU_REDIS_URL || "redis://127.0.0.1:6379";

const redisSettings = {
  tls: {
    rejectUnauthorized: false
  }
}
const queueSettings = {
  lockDuration: 100000, // 100 seconds allowed per job
  lockRenewTime: 50000,
  stalledInterval: 100000,
  maxStalledCount: 0
}

const queueOpts = {
  settings: queueSettings,
  redis: redisSettings
}

function createQueue(name) {
  try {
    const queue = new Queue(name, REDIS_URL, queueOpts);
    return queue;
  } catch (error) {
    console.log(`Failed to create a queue: ${error.message}`);
    console.log(`Exiting...`);
    process.exit(1);
  }
}

function createClient() {
  return redis.createClient(REDIS_URL, redisSettings);
}

module.exports = {
  createQueue: createQueue,
  createClient: createClient
}