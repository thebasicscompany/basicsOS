// The host's design-system defaults as a plain stylesheet, auto-injected into
// every hosted-app bundle (writeHostedBundle) so apps look NATIVE without the
// generator having to get colors/contrast right. It styles bare semantic markup
// (<button>, <input>, <textarea>, <select>, .card, .container, table, headings)
// using the host theme tokens — which applyTheme() (in the bridge boilerplate)
// sets from host:init. The :root block holds dark-mode fallbacks so the app looks
// correct on first paint and even if the bridge is slow; applyTheme then refines
// to the user's exact resolved theme. Mirrors src/components/ui/{button,input}.tsx.

export const HOST_APP_BASE_CSS = `
:root{
  --background:#0a0a0a;--foreground:#fafafa;--card:#161616;--card-foreground:#fafafa;
  --popover:#161616;--popover-foreground:#fafafa;--primary:#e6e6e6;--primary-foreground:#171717;
  --secondary:#262626;--secondary-foreground:#fafafa;--muted:#262626;--muted-foreground:#a1a1a1;
  --accent:#262626;--accent-foreground:#fafafa;--destructive:#dc2626;--border:#2a2a2a;
  --input:#161616;--ring:#737373;--radius:0.5rem;
  --app-font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:var(--background);color:var(--foreground);
  font-family:var(--app-font);font-size:14px;line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
.container{max-width:880px;margin:0 auto;padding:24px}
h1{font-size:24px;font-weight:600;line-height:1.2;margin:0 0 8px;letter-spacing:-0.01em}
h2{font-size:18px;font-weight:600;margin:0 0 8px}
h3{font-size:15px;font-weight:600;margin:0 0 4px}
p{margin:0 0 8px}
small,.muted{color:var(--muted-foreground)}
a{color:var(--primary);text-decoration:none}
a:hover{text-decoration:underline}
hr{border:0;border-top:1px solid var(--border);margin:16px 0}

.card{
  background:var(--card);color:var(--card-foreground);
  border:1px solid var(--border);border-radius:var(--radius);
  padding:20px;
}
.card + .card{margin-top:16px}

label{display:block;font-size:13px;font-weight:500;margin:0 0 6px;color:var(--foreground)}

button,.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  height:36px;padding:0 16px;border:0;border-radius:calc(var(--radius) - 2px);
  background:var(--primary);color:var(--primary-foreground);
  font-family:inherit;font-size:14px;font-weight:500;line-height:1;white-space:nowrap;
  cursor:pointer;transition:opacity .15s ease,background .15s ease;
}
button:hover,.btn:hover{opacity:.9}
button:focus-visible,.btn:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
button:disabled,.btn:disabled{opacity:.5;cursor:not-allowed;pointer-events:none}
button.secondary{background:var(--secondary);color:var(--secondary-foreground)}
button.outline{background:transparent;color:var(--foreground);border:1px solid var(--border)}
button.outline:hover{background:var(--accent);opacity:1}
button.ghost{background:transparent;color:var(--foreground)}
button.ghost:hover{background:var(--accent);opacity:1}
button.destructive{background:var(--destructive);color:#fff}

input,textarea,select{
  display:block;width:100%;height:36px;padding:0 12px;
  background:var(--card);color:var(--foreground);
  border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);
  font-family:inherit;font-size:14px;line-height:1.5;outline:none;
  transition:border-color .15s ease,box-shadow .15s ease;
}
textarea{height:auto;min-height:84px;padding:8px 12px;resize:vertical}
select{appearance:none;cursor:pointer}
input::placeholder,textarea::placeholder{color:var(--muted-foreground)}
input:focus,textarea:focus,select:focus{border-color:var(--ring);box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 35%,transparent)}
input:disabled,textarea:disabled{opacity:.5;cursor:not-allowed}

table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)}
th{color:var(--muted-foreground);font-weight:500;font-size:13px}
tr:last-child td{border-bottom:0}

.row{display:flex;gap:8px;align-items:center}
.col{display:flex;flex-direction:column;gap:8px}
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;background:var(--secondary);color:var(--secondary-foreground);font-size:12px;font-weight:500}
`.trim();

/** Inject the host base stylesheet into a generated bundle, placed LAST (before
 * </body>) so it wins over any colors/button/input styling the generator added
 * — apps routinely restyle buttons (causing unreadable contrast), and the host
 * design system must be authoritative. applyTheme (JS inline on <html>) still
 * overrides the :root token fallbacks at runtime, so the user's exact theme wins. */
export function injectHostBaseStyles(html: string): string {
  const tag = `<style data-host-base>\n${HOST_APP_BASE_CSS}\n</style>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${tag}\n</body>`);
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${tag}\n</head>`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${tag}`);
  }
  return `${html}\n${tag}`;
}
