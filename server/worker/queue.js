const Queue = require('bull'); // for worker process

let REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
// Create / Connect to a named work queue
let queueOpts = {
  settings: {
    lockDuration: 100000 // 100 seconds allowed per job
  },
  redis: {
    tls: {
      rejectUnauthorized: false
    }
  }
}
let actionQueue = new Queue('action', REDIS_URL, queueOpts);

let gameInitQueue = new Queue('init', REDIS_URL, queueOpts);

async function inspectQueue(queue) {
  const jobs = await queue.getJobs(['active', 'waiting', 'delayed', 'completed', 'failed']);
  const promises = jobs.map(async (job) => {
    const state = await job.getState();
    let reason = state == 'failed' ? job.failedReason : null;
    return `Job ${job.id}: ${state} ${reason}`;
  })
  const reports = await Promise.all(promises);
  reports.forEach(report => console.log(report));
  return true
}

inspectQueue(actionQueue)
  .then(() => {
    return inspectQueue(gameInitQueue);
  })
  .then(() => {
    process.exit(1);
  });

