// prerender.cjs
require("esbuild-register/dist/node").register({
  jsx: "automatic",
  jsxImportSource: "react",
  target: "esnext",
});

// Import your actual prerender logic (TSX file)
import("./prerender.tsx");
