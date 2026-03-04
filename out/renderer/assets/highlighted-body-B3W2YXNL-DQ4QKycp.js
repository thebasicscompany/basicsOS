import { R, K as Ks, Q as Qe } from "./index-CznMF7EN.js";
import { r as reactExports, j as jsxRuntimeExports } from "./proxy-CG65NCoh.js";
var L = ({ code: s, language: t, raw: e, className: n, ...d$1 }) => {
  let { shikiTheme: l } = reactExports.useContext(R), o = Ks(), [m, i] = reactExports.useState(e);
  return reactExports.useEffect(() => {
    if (!o) {
      i(e);
      return;
    }
    let g = o.highlight({ code: s, language: t, themes: l }, (p) => {
      i(p);
    });
    g && i(g);
  }, [s, t, l, o, e]), jsxRuntimeExports.jsx(Qe, { className: n, language: t, result: m, ...d$1 });
};
export {
  L as HighlightedCodeBlockBody
};
