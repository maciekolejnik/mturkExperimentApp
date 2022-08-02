const aux = require('./util/auxiliary');
const flip = aux.flip;
const uniformDraw = aux.uniformDraw;
// let LOOKAHEAD_LIMIT = 4

/**
 *
 * @param answers
 * @param informed
 * @param role of the participant
 * @param limit
 * @returns
 */
let estimateLookahead = function(answers, informed, role, limit) {
  // answers are numbers for horizon and money request questions
  let priorByLimit = [
    {vs: [0]},
    {ps: [1/3, 2/3], cs: [0,1]},
    {ps: [1/8, 2/8, 5/8], cs: [0,1,2]},
    {ps: [1/13,2/13,5/13,5/13], vs: [0,1,2,3]},
    {ps: [1/14,2/14,5/14,5/14,1/14], vs: [0,1,2,3,4]}
  ]
  let prior = priorByLimit[Math.min(4, limit)]
  let estimated = 20 - answers.moneyRequest
  let simplify = role === 'investor'
  return informed ? { prior, estimated, simplify } : { prior, simplify }
}

// based on answers to lottery questions, estimate rationality
// (in particular, its mean and dev as it's assumed to be normal)
// by starting form 16 and going up/down depending on
// correct/incorrect answer
/**
 *
 * @param answers
 * @param informed
 * @param role of the participant
 * @returns [Float] array of possible values (assumed equally likely)
 */
function estimateRationality(answers, informed, role) {
  const baseRationality = 16
  const baseDev = 8
  const correctPreferences = [0,2,1]
  const actualPreferences = [answers.lottery1, answers.lottery2, answers.lottery3]
  const correctness = correctPreferences.map((pref, i) => pref == actualPreferences[i])
  const computedRat = correctness.reduce((acc, x) => {
    const nextRat = x ? acc[0] + acc[1] : Math.max(acc[0] - acc[1], 0)
    return [nextRat, acc[1] / 2]
  }, [baseRationality,baseRationality])
  // const computedRat = reduce(function(x, acc) {
  //   const prevRationality = acc[0]
  //   const factor = acc[1]
  //   const nextRationality = x ? prevRationality + factor : max(prevRationality - factor, 0)
  //   return [nextRationality, factor / 2]
  // }, [baseRationality,baseRationality], correctness)
  const computedDev = correctness.every(x => x) || correctness.every(x => !x) ?
    8 : 16
  let expectedRationality = informed ? computedRat[0] : 2 * baseRationality
  let dev = informed ? computedDev : baseDev
  let samples = role === 'investor' ? 1 : 3
  return getNormalSamples(expectedRationality, dev, samples)
  // return { expectedRationality, dev }
}

function gaussian(mean, dev) {
// Standard Normal variate using Box-Muller transform.
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    const standard = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    return standard * dev + mean;
}

function getNormalSamples(mean, dev, samples) {
  let generate = function() {
    let s = gaussian(mean, dev)
    if (s > 0) return s
    return generate()
  }
  if (samples === 1) return [mean]
  return Array.from(Array(samples).keys()).map(generate)
  // return repeat(samples, generate)
  // return Infer({method: 'forward', samples: samples, model: function() {
  //     return generate()
  //   }});
}

function estimateTrust(answers, informed) {
  return informed ? -0.1 + 0.2 * answers.trust : 0.5
}

// this function generates bot's belief
function estimateGoalCoeffs(answers, informed) {
  // answers contains a 1-5 self attribution of altruism
  // towards robots
  // 1 - don't care about what robot thinks about me,
  // 5 - care very much
  const altruism = answers.altruism;
  // let altruismNormalised = (altruism - 1) / 4
  // goal coeffs format [ money, trust]
  return informed ? [2.25 - altruism * 0.25, 0.75 + 0.25 * altruism] : [1,1];
}

let generateCondition = function() {
  // mult factor either 2 or 3
  let horizonDisclosed = flip()
  let role = flip() ? 'investor' : 'investee'
  // let role = 'investor'
  let prior = flip()
  // let prior = false
  let botCoeffs = uniformDraw([0,1,2])
  return {
    horizonDisclosed, role, prior, botCoeffs
  }
}

/** @param role of the participant */
let generateRobotParams = function(lookAheadLimit, coeffs, role) {
  // let lookAheadLimit = globalStore.params.lookAhead
  // when bot is an investor lookahead of 2 is sufficient
  // otherwise should be as high as it gets
  let lookAhead = role === 'investee' ? 2 : lookAheadLimit
  // resp. selfless, neutral, greedy
  let goalCoeffs = [[.3,.7],[.5,.5],[.8,.2]][coeffs]
  return {
    goalCoeffs,
    metaParams: {
      alpha: 1000,
      discountFactor: 0.8,
      lookAhead: lookAhead
    },
    usesHeuristics: true
  }
}

/** returns a serialisable representation of bot's state
 * role is role of the participant */
let generateInitialState = function(answers, params, informed, role) {
  let belief = estimateGoalCoeffs(answers, informed)
  let trust = estimateTrust(answers, informed)
  let isInvestee = role === 'investor'
  let alpha = estimateRationality(answers, informed, role)
  let lookAhead = estimateLookahead(answers, informed, role, params.lookAhead)
  let discountFactor = 0.8
  return {
    isInvestee, /** bool */
    belief, /** array, eg [2,1] */
    trust, /** value, eg, 0.3 */
    metaParamsEstimations: {
      alpha, /** array of values */
      lookAhead, /** {prior, estimated, simplify} */
      discountFactor /** value */
    }
  }
}

function gameInit(answers, params) {
  const condition = generateCondition()
  const initialState = generateInitialState(answers, params, condition.prior, condition.role)
  const robotParams = generateRobotParams(params.lookAhead, condition.botCoeffs, condition.role)
  const result = {
    condition, initialState, params: robotParams
  };
  return result;
}

module.exports = {
  gameInit
}

// const answers = {
//   lottery1: 0,
//   lottery2: 2,
//   lottery3: 1,
//   trust: 3,
//   altruism: 1,
//   moneyRequest: 18
// };
// const params = {
//   lookAhead: 4
// }
//
// const res = gameInit(answers, params)
// console.log(res);
// console.log(res.initialState.metaParamsEstimations.alpha);
// console.log(res.initialState.metaParamsEstimations.lookAhead);
// process.exit(1)