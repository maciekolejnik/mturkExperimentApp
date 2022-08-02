/**
 * PERFORM VARIOUS MTURK OPERATIONS USING API
 *
 * # Run
 * 1. Make sure AWS secret is loaded in your terminal session
 * (in my case ```export AWS_PROFILE=qavas```)
 * 2. Run the file with appropriate command and being careful about MTURK_PROD
 * E.g.
 *  export MTURK_PROD=true && node server/mturk/query.js checkBalance && export MTURK_PROD=false
 *
 */

const mturk = require('./mturk');

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
// const argv = yargs(hideBin(process.argv)).argv

yargs(hideBin(process.argv))
  .command('checkStatus <HITId>', 'check status of a HIT', (yargs) => {
    return yargs
      .positional('HITId', {
        describe: 'id of the HIT to check status of'
      })
  }, (argv) => {
    mturk.checkHITStatus(argv.HITId);
  })
  .command('listAssignments <HITId> [status]', 'list assignments for a HIT', (yargs) => {
    return yargs
      .positional('HITId', {
        describe: 'id of the HIT to check assignments for'
      })
      .positional('status', {
        describe: 'status of assignments to recover'
      })
  }, (argv) => {
    mturk.listAssignmentsForHIT(argv.HITId, argv.status);
  })
  .command('overrideReject <assignmentID> <message>', 'approve a rejected assignment', (yargs) => {
    return yargs
      .positional('assignmentID', {
        describe: 'id of the assignment to approve'
      })
      .positional('message', {
        describe: 'message to send to the worker'
      })
  }, (argv) => {
    mturk.overrideRejection(argv.assignmentID, argv.message);
  })
  .command('listBonuses [HITId] [assignmentID] [token]', 'list bonus payment for a HIT ot an assignment', (yargs) => {
    return yargs
      .positional('HITId', {
        describe: 'id of the HIT to list bonuses for'
      })
      .positional('assignmentID', {
        describe: 'id of the assignment to list bonuses for'
      })
      .positional('token', {
        describe: 'optional token to use for the request'
      })
  }, (argv) => {
    mturk.listBonusPayments(argv.HITId, argv.assignmentID, argv.token);
  })
  .command('sendBonus <assignmentID> <workerID> <amount> <message> [token]', 'send bonus to worker', (yargs) => {
    return yargs
      .positional('assignmentID', {
        describe: 'id of the assignment this relates to'
      })
      .positional('workerID', {
        describe: 'id of the worker to pay'
      })
      .positional('amount', {
        describe: 'how much bonus to pay'
      })
      .positional('message', {
        describe: 'message to send to the worker'
      })
      .positional('token', {
        describe: 'optional request token (used for repeated request)'
      })
  }, (argv) => {
    mturk.sendBonusExternal(argv.assignmentID, argv.workerID, argv.amount, argv.message, argv.token);
  })
  .command('checkBalance', 'check balance on the account', (argv) => {
    mturk.printBalance();
  })
  .command('listHITs', 'list HITs for the account', (argv) => {
    mturk.listHITs();
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging'
  })
  .help()
  .parse()