import {unitEnding} from "../../auxiliary";

function Investment(props) {
  return (
    <p>
      {props.player} <strong>invested {props.investment}</strong> {unitEnding(props.investment)}.
    </p>
  );
}

export default Investment;