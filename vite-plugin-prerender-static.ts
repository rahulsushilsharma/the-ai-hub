import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

export default function prerenderStaticPlugin(): Plugin {
  const routes = [
    { path: "/chat", title: "Chat" },
    { path: "/tts-demo", title: "TTS Demo" },
    { path: "/huggingface-chat", title: "Huggingface Chat" },
    { path: "/bg-remover", title: "Background Remover" },
  ];

  function updatePathAttribute(tag: string, attrName: string) {
    return tag.replace(
      new RegExp(`(${attrName}\\s*=\\s*(["'])[^"']*?)\\./`, "gi"),
      (_match, _prefix, quote) => {
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

  return {
    name: "vite-plugin-prerender-static",
    apply: "build" as const, // ✅ literal type (fixes TS error)
    closeBundle() {
      const rootDir = process.cwd(); // use project root
      const distDir = path.resolve(rootDir, "dist");
      const htmlPath = path.join(distDir, "index.html");
      const templatePath = path.resolve(rootDir, "template.html");

      if (!fs.existsSync(htmlPath) || !fs.existsSync(templatePath)) {
        console.warn(
          "⚠️ Missing index.html or template.html — skipping prerender"
        );
        return;
      }

      console.log("⚙️  Running prerender-static plugin...");

      const html = fs.readFileSync(htmlPath, "utf8");

      const scriptRegex = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
      const linkRegex = /<link\b[^>]*>/gi;

      let scriptTags: string[] = html.match(scriptRegex) || [];
      let linkTags: string[] = html.match(linkRegex) || [];

      scriptTags = scriptTags.map((tag) => updatePathAttribute(tag, "src"));
      linkTags = linkTags.map((tag) => updatePathAttribute(tag, "href"));

      const allTags = [...scriptTags, ...linkTags].join("\n");
      const template = fs.readFileSync(templatePath, "utf-8");

      for (const route of routes) {
        const appHtml = `hello world`;

        const finalHtml = template
          .replace("%TITLE%", route.title)
          .replace("%APP%", appHtml)
          .replace("%LINKS%", allTags);

        const filePath =
          route.path === "/" ? "/index.html" : `${route.path}/index.html`;
        const fullPath = path.join(distDir, filePath);

        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, finalHtml);
        console.log(`✅ Generated ${filePath}`);
      }

      console.log("🏁 Prerender complete!");
    },
  };
}
