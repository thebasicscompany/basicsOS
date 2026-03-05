import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-B1ypeg0h.js";
import { _ as __name } from "./index-8N5YxRr3.js";
import "./chunk-FMBD7UC4-HtBmlA1N.js";
import "./chunk-55IACEB6-CAAAj__R.js";
import "./chunk-QN33PNHL-DKfm92BT.js";
import "./proxy-C_MfoVi8.js";
var diagram = {
  parser: classDiagram_default,
  get db() {
    return new ClassDB();
  },
  renderer: classRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.class) {
      cnf.class = {};
    }
    cnf.class.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
