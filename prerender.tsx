// prerender.tsx

import { register } from "esbuild-register/dist/node.js";
register({
  jsx: "automatic",
  jsxImportSource: "react",
});

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define all routes to statically render
const routes = [
  { path: "/", title: "Home" },
  { path: "/chat", title: "Chat" },
  { path: "/tts-demo", title: "TTS Demo" },
  { path: "/huggingface-chat", title: "Huggingface Chat" },
  { path: "/bg-remover", title: "Background Remover" },
];

const template = fs.readFileSync("./template.html", "utf-8");

for (const route of routes) {
  // Wrap the entire router in a StaticRouter
  const appHtml = `hello world`;

  const html = template
    .replace("%TITLE%", route.title)
    .replace("%APP%", appHtml);

  const filePath =
    route.path === "/" ? "/index.html" : `${route.path}/index.html`;
  const fullPath = path.join(__dirname, "dist", filePath);

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, html);
  console.log(`✅ Generated ${filePath}`);
}
