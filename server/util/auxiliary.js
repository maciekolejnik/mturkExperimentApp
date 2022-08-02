const assert = require('assert').strict;

const debug = process.env.DEBUG > 1;
function log(msg) {
  if (debug) {
    console.log(msg);
  }
}

function setupPeriodicDebugLogs(callback) {
  assert(callback, `setupPeriodicDebugLogs(): a callback must 
  be passed but not found.`)
  if (debug) {
    const interval = 60 * 1000 // 1 minute
    setInterval(callback, interval);
  }
}

function makeid(length) {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() *
      charactersLength));
  }
  return result;
}

/** compute earnings of both players in trust game
 *
 * @param history
 * @param setup
 * @returns {*}
 */
function computeEarnings(history, setup) {
  const endowments = setup.endowments;
  const k = setup.k;
  const earningsByRound = history.map(transfers => {
    const invested = transfers.invested;
    const returned = transfers.returned;
    return {
      investor: endowments.investor - invested + returned,
      investee: endowments.investee + invested * k - returned
    }
  });
  const earnings = earningsByRound.reduce((a,b) => {
    return {
      investor: a.investor + b.investor,
      investee: a.investee + b.investee
    }
  });
  return earnings;
}

// function computeEarnings(history, role, setup) {
//   const endowment = setup.endowments[role];
//   const k = setup.k;
//   const earningsByRound = history.map(transfers => {
//     const invested = transfers.invested;
//     const returned = transfers.returned;
//     return (role === 'investor') ? endowment - invested + returned :
//       endowment + invested * k - returned;
//   })
//   const earnings = earningsByRound.reduce((a,b) => a + b);
//   return earnings;
// }

function now() {
  return new Date().getTime();
}

function getElapsedMessage(startTime, endTime, taskName) {
  const elapsed = (endTime - startTime) / 1000;
  return `${taskName} took ${elapsed.toFixed(2)} seconds.`
}

function getBotType(condition) {
  return ['selfless', 'neutral', 'greedy'][condition];
}

/** probability sampling */
function flip() {
  return Math.random() < 0.5
}

function uniformDraw(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function comprehensionBonus(correct, last, timeInSeconds) {
  if (correct) return 1.8;
  if (!last) return 0;
  // otherwise we know it's failed
  /** bonus structure for time taken to submit comprehension,
   * increments of 60 secs, so [ 0-60s, 1-2 min, 2-3 min, 3-4min, 4+min] */
  const comprehensionBonusStructure = [0, 0.2, 0.4, 0.6, 0.8];
  const bucket = Math.min(Math.floor(timeInSeconds / 60), 4);
  assert(bucket >= 0 && bucket <= 4);
  return comprehensionBonusStructure[bucket];
}

module.exports = {
  log,
  setupPeriodicDebugLogs,
  makeid,
  computeEarnings,
  now,
  getElapsedMessage,
  getBotType,
  flip,
  uniformDraw,
  comprehensionBonus
}