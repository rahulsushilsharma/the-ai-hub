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
  { path: "/chat", title: "Chat" },
  { path: "/tts-demo", title: "TTS Demo" },
  { path: "/huggingface-chat", title: "Huggingface Chat" },
  { path: "/bg-remover", title: "Background Remover" },
];

function updatePathAttribute(tag, attrName) {
  return tag.replace(
    new RegExp(`(${attrName}\\s*=\\s*(["'])[^"']*?)\\./`, "gi"),
    (match, prefix, quote, offset, string) => {
      // Find the full attribute value
      const attrRegex = new RegExp(
        `${attrName}\\s*=\\s*${quote}([^${quote}]*)${quote}`,
        "i"
      );
      const fullMatch = tag.match(attrRegex);
      if (fullMatch) {
        const fullValue = fullMatch[1];
        const updatedValue = fullValue.replace(/\.\//g, "../");
        return tag.replace(fullValue, updatedValue);
      }
      return tag;
    }
  );
}

// Read the HTML file (replace 'yourfile.html' with the actual file path)
const html = fs.readFileSync("./dist/index.html", "utf8");

// Regex to match <script> tags (including content, handling multiline)
const scriptRegex = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
let scriptTags = html.match(scriptRegex) || [];

// Update src in script tags
scriptTags = scriptTags.map((tag) => updatePathAttribute(tag, "src"));

// Regex to match <link> tags (self-closing, attributes included)
const linkRegex = /<link\b[^>]*>/gi;
let linkTags = html.match(linkRegex) || [];

// Update href in link tags
linkTags = linkTags.map((tag) => updatePathAttribute(tag, "href"));

// Output the results as arrays of strings
console.log("Updated Script tags:", scriptTags);
console.log("Updated Link tags:", linkTags);

// Optional: If you want them concatenated into a single string
const allTags = [...scriptTags, ...linkTags].join("\n");
const template = fs.readFileSync("./template.html", "utf-8");

console.log(scriptTags, linkTags);

for (const route of routes) {
  // Wrap the entire router in a StaticRouter
  const appHtml = `hello world`;

  const html = template
    .replace("%TITLE%", route.title)
    .replace("%APP%", appHtml)
    .replace("%LINKS%", allTags);

  const filePath =
    route.path === "/" ? "/index.html" : `${route.path}/index.html`;
  const fullPath = path.join(__dirname, "dist", filePath);

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, html);
  console.log(`✅ Generated ${filePath}`);
}
