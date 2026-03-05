import { U as Utils, C as Color } from "./index-8N5YxRr3.js";
const channel = (color, channel2) => {
  return Utils.lang.round(Color.parse(color)[channel2]);
};
export {
  channel as c
};
