import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-BuC6tgd_.js";
import { _ as __name } from "./index-CznMF7EN.js";
import "./chunk-FMBD7UC4-DrGLuoeN.js";
import "./chunk-55IACEB6-DaJSqhqd.js";
import "./chunk-QN33PNHL-Dbp9LgzB.js";
import "./proxy-CG65NCoh.js";
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
