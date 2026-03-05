import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-DI55MBZ5-C1Ogp1ZJ.js";
import { _ as __name } from "./index-8N5YxRr3.js";
import "./chunk-55IACEB6-CAAAj__R.js";
import "./chunk-QN33PNHL-DKfm92BT.js";
import "./proxy-C_MfoVi8.js";
var diagram = {
  parser: stateDiagram_default,
  get db() {
    return new StateDB(2);
  },
  renderer: stateRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.state) {
      cnf.state = {};
    }
    cnf.state.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
