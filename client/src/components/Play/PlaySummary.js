import {unitEnding} from "../../auxiliary";

/** computes earnings of both players UNTIL NOW or in a given ROUND
 * @param {string} role | for which player to compute
 * @param {number} [round] (optional) | for which round to compute earnings
 * @returns {Endowments}
 */
function computeEarnings(history, endowments, k, role, round) {
  const roundEarnings = history.map((roundData) => {
    const invested = roundData.invested;
    const returned = roundData.returned;
    const investorEarning = endowments.investor - invested + returned;
    const investeeEarning = endowments.investee + k * invested - returned;
    return {
      investor: investorEarning,
      investee: investeeEarning
    };
  });
  if (round !== undefined) {
    return roundEarnings[round-1];
  }
  const totalEarnings = roundEarnings.reduce((acc, cur) => {
    return {
      investor: acc.investor + cur.investor,
      investee: acc.investee + cur.investee
    }
  }, {investor: 0, investee: 0})
  return totalEarnings[role];
}

function PlaySummary(props) {
  const unitToDollarRatio = props.unitToDollarRatio;
  const endowments = props.endowments;
  const history = props.history;
  const k = props.k;
  const role = props.role;
  // const earnings = props.earnings;

  const unitEarnings = computeEarnings(history, endowments, k, role);
  const dollarEarnings = unitEarnings / unitToDollarRatio;
  const dollarEarningsFormat = (Math.round(100 * dollarEarnings) / 100).toFixed(2);
  return (
    <div className="summary">
      <hr/>
      <h2>Game Summary</h2>
      <p>
        The game is finished.
        <br/>
        You earned {unitEarnings} {unitEnding(unitEarnings)} which
        translates to a ${dollarEarningsFormat} performance
        bonus.
        <br/>
        You will also receive the $1.80 completion bonus.
        <br/>
        They will be paid as a single bonus shortly after you submit the task.
      </p>
      <hr/>
    </div>
  );
}

export default PlaySummary;