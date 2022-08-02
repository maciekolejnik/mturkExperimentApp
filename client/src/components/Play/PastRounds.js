import {unitEnding} from "../../auxiliary";

import Investment from './Investment';
import Return from "./Return";

/**
 *
 * @param props
 * @returns {JSX.Element}
 */
function PastRounds(props) {
  const history = props.history;
  const endowments = props.endowments;
  const isInvestor = props.isInvestor;
  const horizon = props.horizon;
  const k = props.k

  function PastRound(props) {
    const order = isInvestor ? ["You", "The bot"] : ["The bot", "You"]
    const invested = props.invested;
    const returned = props.returned;
    const received = k * invested;
    const earnings = isInvestor ?
      (endowments.investor - invested + returned) :
      (endowments.investee + k * invested - returned);
    const uninvested = endowments.investor - invested;
    const investeeEarningsExplanation = (received === 0 && '') ||
      (returned === 0 && ` (since bot gave you that much and you didn't return anything)`) ||
      ` (${received} ${unitEnding(received)} that you received minus ${returned} that you returned)`;
    const uninvestedExplanation = `${uninvested} ${unitEnding(uninvested)} that you didn't invest`;
    const returnedExplanation = `${returned} ${unitEnding(returned)} that you received from the bot`;
    const investorEarningsExplanation =
      (uninvested + returned === 0 && ` (since you invested all you had and didn't get anything back)`) ||
      (uninvested > 0 && returned > 0 && ` (${uninvestedExplanation} and ${returnedExplanation})`) ||
      (uninvested > 0 && ` (${uninvestedExplanation})`) ||
      ` (since you invested all you had and the bot returned ${returned})`
    const earningsExplanation = isInvestor ?
      investorEarningsExplanation : investeeEarningsExplanation;
    // const earningsExplanation = !isInvestor ?
    //   ` (${received} ${unitEnding(received)} that you received minus ${returned} that you returned)`
    //   :
    //   ` (${uninvested} ${unitEnding(uninvested)} that you didn't invest and ` +
    //   `${returned} that you received from the bot)`
    const roundsOutOf = horizon && ` (out of ${horizon})`
    return (
      <div className="round">
        <h2>Round {props.roundNo}{roundsOutOf}</h2>
        <Investment player={order[0]} investment={invested}/>
        <Return player={order[1]} available={received} returned={returned}/>
        <p>In this round, you <strong>earned {earnings}</strong> {unitEnding(earnings)}{earningsExplanation}.</p>
      </div>
    );
  }

  const pastRounds = history.map((round, i) => {
    return <PastRound key={i} roundNo={i + 1} invested={round.invested}
                      returned={round.returned} isInvestor={isInvestor}
                      endowments={endowments} k={k}/>
  });

  return (
    <div>
      {pastRounds}
    </div>
  );
}

export default PastRounds;