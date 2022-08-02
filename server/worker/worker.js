/** load external libraries */
const throng = require('throng');

/** load local stuff */
const aux = require('../util/auxiliary')
const log = aux.log;
const webpplAux = require('../webppl/webpplAux');
const { createQueue, createClient } = require('./redisAux');

// Spin up multiple processes to handle jobs to take advantage of more CPU cores
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
const workers = process.env.WEB_CONCURRENCY || 2;


/** REDIS AND BULL QUEUE */
const client = createClient();

/**
 *
 * @param userId
 * @param info object of the form
 * {
      belief // the function that gives access to cache (belief.cache)
    }
 */
function updateRedisCache(userId, info) {
  const beliefCache = info.belief.cache
  const pairs = beliefCache.keys().reduce((acc, key) => {
    acc.push(key.substring(1, key.length - 1));
    const value = JSON.stringify(beliefCache.get(key));
    acc.push(value);
    return acc;
  }, []);
  client.hmset(userId, pairs, (err, res) => {
    if (err) {
      console.log(`Failed to update cache for user ${userId}:` +
        err.message);
    } else {
      log(`Cache successfully updated for user ${userId}: ` +
        res);
    }
  });
}

// The maximum number of jobs each worker should process at once. This will need
// to be tuned for your application. If each job is mostly waiting on network
// responses it can be much higher. If each job is CPU-intensive, it might need
// to be much lower.
let maxJobsPerWorker = 1;

/** END REDIS, QUEUE CONFIG */

function getParamsFromRecord(userRecord) {
  const role = userRecord.setup.role;
  const botRole = role === 'investor' ? 'investee' : 'investor';
  const investments = userRecord.history.map(x => x.invested).reverse();
  const returns = userRecord.history.map(x => x.returned).reverse();
  return {
    gameSpecificParams: {
      k: userRecord.setup.k,
      endowments: userRecord.setup.endowments
    },
    options: {
      horizon: userRecord.setup.horizon,
      beliefRepresentation: 'dirichlet'
    },
    botParams: userRecord.botParams,
    botState: userRecord.botState,
    roles: {
      bot: botRole,
      opponent: role
    },
    history: {
      investments,
      returns
    }
  }
}

function getCacheRetrieveHandler(userId, params, callback) {
  const handler = (err, object) => {
    if (err) {
      console.log(`worker.js: Failed to retrieve cache contents for ` +
        `${userId}: ${err.message}`);
    }
    const updatedParams = {...params,
      cache: {
        belief: object
      }
    }
    webpplAux.computeBotAction(updatedParams, callback);
  }
  return handler;
}

function computeBotReturn(userId, userRecord, investment, callback) {
  const partialParams = getParamsFromRecord(userRecord);
  const partialInvestments = partialParams.history.investments;
  const params = {...partialParams,
    history: {
      investments: [investment].concat(partialInvestments),
      returns: partialParams.history.returns
    }
  };
  client.hgetall(userId, getCacheRetrieveHandler(userId, params, callback));
}

function computeBotInvestment(userId, userRecord, callback) {
  const params = getParamsFromRecord(userRecord);
  client.hgetall(userId, getCacheRetrieveHandler(userId, params, callback));
}

function start(workerId) {
  log(`Worker ${workerId} (out of ${workers}) starting...`);
  if (webpplAux.init(workerId)) {
    let actionQueue = createQueue('action');

    actionQueue.process('invest', maxJobsPerWorker, (job, done) => {
      const startTime = aux.now();
      const userId = job.data.userId;
      log(`worker.js: Processing actionQueue:invest job ${job.id} for user ${userId} by worker ${workerId}`);
      // record contains game parameters for this user
      const userRecord = job.data.record;
      // retrieve bot setup, then continue with computing action
      computeBotInvestment(userId, userRecord, function (result) {
        console.log(aux.getElapsedMessage(startTime, aux.now(),
          `Computing bot investment for user ${userId}`));
        if (result.ok) {
          updateRedisCache(userId, result.cache);
          done(null, result.action);
        } else {
          done(new Error(result.message));
        }
      })
    });

    actionQueue.process('return', maxJobsPerWorker, (job, done) => {
      const startTime = aux.now();
      const userId = job.data.userId;
      log(`Processing actionQueue:return job ${job.id} for user ${userId} by worker ${workerId}`);
      // record contains game parameters for this user
      const userRecord = job.data.record;
      const investment = job.data.investment;
      computeBotReturn(userId, userRecord, investment, function (result) {
        console.log(aux.getElapsedMessage(startTime, aux.now(),
          `worker.js: Computing bot return for user ${userId}`));
        if (result.ok) {
          updateRedisCache(userId, result.cache);
          done(null, result.action);
        } else {
          done(new Error(result.message));
        }
      });
    });
  }
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start })
.then(() => {})
.catch(err => {
  console.log(`Failed to start the worker process: ${err.message}`);
});