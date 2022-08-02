import femaleInvestor from "../femaleInvestor.png";
import maleInvestor from "../maleInvestor.png";
import femaleInvestee from "../femaleInvestee.png";
import maleInvestee from "../maleInvestee.png";

import {roundEnding} from "../auxiliary";

/** expects
 * - props.horizon (int, may be null)
 * - props.isInvestor (bool)
 * - props.gender (0/1)
 * - props.endowments ({investor: <int>, investee: <int>})
 * - props.k (int)
 */
function GameDescription(props) {
  const horizon = props.horizon;
  const isInvestor = props.isInvestor;
  const gender = props.gender;
  const endowments = props.endowments;
  const k = props.k;

  // useEffect(() => {
  //   console.log('gameDescription mounting');
  //
  //   return () => { console.log('GameDescription unmounting') };
  // }, []);

  function Intro() {
    return (
      <p>
        You will now play a simple game called Trust Game against a <em>bot</em>.
        We explain what that means below. Please read the description carefully as we
        will ask you questions to ensure understanding. You will get two chances to
        answer the questions correctly; if you don't, your submission will be rejected.
      </p>
    );
  }
  function Currency() {
    return (
      <div>
        <h3>Currency</h3>
        <p>The Trust Game is a money-exchange game. However, instead of dollars,
          we use abstract monetary <em>units</em>, where 20 units = $1,
          4 units = $0.20, 1 unit = $0.05 etc.</p>
      </div>
    );
  }
  function PlayDescription() {
    const numbersAsWord = ['zero', 'one', 'two', 'three', 'four', 'five',
      'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
    const multiplierAsWord = [null, null, 'duplicated', 'tripled', 'quadrupled'];

    function RoundsInfo() {
      function HorizonDisclosed() {
        return (
          <p>
            The game is played through <strong>{numbersAsWord[horizon]} identical {roundEnding(horizon)}</strong>.
          </p>
        );
      }
      function HorizonUndisclosed() {
        return (
          <p>
            The game is played through a number of identical rounds. Because of the
            experimental condition you have been assigned to, we can't tell
            you exactly how many rounds will be played, but it will be more than 2
            and no more than 20.
          </p>
        );
      }

      return horizon ? <HorizonDisclosed/> : <HorizonUndisclosed/>;
    }

    function RoundDescription() {
      return isInvestor ?
        <p>
          <img alt="a robot and a human exchanging money" src={gender === 1 ? femaleInvestor : maleInvestor} width="180" height="180" />
          In <b>each round</b> you receive {endowments.investor} units,
          and you can <b>invest</b> any part of your endowment by giving it
          to the robot. The amount you invest gets <b>{multiplierAsWord[k]}</b> in
          transit. Subsequently the
          robot can <b>return</b> to you any part of what it has received.
          For example, if out of your {endowments.investor} units you invest 3
          with the robot, it will receive 6, and then it may return to you
          anything between 0 and 6.
        </p> :
        <p>
          <img alt="a robot and a human exchanging money" src={gender === 1 ? femaleInvestee : maleInvestee} width="180" height="180" />
          In <b>each round</b> the bot receives {endowments.investor} units, and
          it can <b>invest</b> any part of its endowment by giving it to you.
          The amount the bot invests gets <b>{multiplierAsWord[k]}</b> in transit.
          Subsequently you can <b>return</b> to the robot any part of what you
          have received. For example,
          if out of its {endowments.investor} units the bot invests 3 with you,
          you will receive 6, and then you may return to the bot anything
          between 0 and 6.
        </p>
    }

    function EarningsDescriptor() {
      return isInvestor ?
        <p>
          Your earnings in the game get accumulated from round to round,
          but in each single round you can still invest only up to {endowments.investor} units.
        </p> :
        <p>
          Your earnings in the game get accumulated from round to round,
          but in each single round you can return to the bot only up to
          as many units as you received in that round. Similarly, in each
          round, the bot can invest only up to {endowments.investor} units.
        </p>
    }

    return (
      <div>
        <h2>Game Description</h2>
        <RoundsInfo/>
        <RoundDescription/>
        <EarningsDescriptor/>
      </div>
    );
  }

  return (
    <div className="gameDescription">
      <Intro/>
      <Currency/>
      <PlayDescription/>
    </div>
  );
}

export default GameDescription;