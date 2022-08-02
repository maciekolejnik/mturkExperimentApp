// import {useEffect} from "react";

function PaymentInfo(props) {

  // useEffect(() => {
  //   console.log('PaymentInfo mounting');
  //
  //   return () => { console.log('PaymentInfo unmounting') };
  // }, []);

  return props.display && (
    <div>
      <h3>Payment</h3>
      <ol>
        <li>
          <strong>Baseline</strong>: you receive $0.20 baseline remuneration
          for participating in this experiment
        </li>
        <li>
          <strong>Bonus</strong>
          <ul>
            <li>
              <strong>For completion</strong>: you will receive a $1.80 bonus if you
              complete the game.
            </li>
            <li>
              <strong>Performance</strong>: you will also receive a bonus payment
              which will reflect the <strong>number of units you earn</strong> throughout
              the game.
              Units will be converted to dollars using the exchange rate stated
              above (20 units = $1). For example, if you earn 15 units during the
              game, you will receive a $0.75 bonus.
            </li>
          </ul>
        </li>
      </ol>
    </div>
  );
}

export default PaymentInfo;