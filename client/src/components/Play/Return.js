import {unitEnding} from "../../auxiliary";

function Return(props) {
  return (
    <p>
      {props.player} <strong>returned {props.returned}</strong> {unitEnding(props.returned)}.</p>
  );

}

export default Return;