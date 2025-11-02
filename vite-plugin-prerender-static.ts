// vite-plugin-prerender-static.ts
import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

// 🧠 Define available options
export interface PrerenderOptions {
  routes: { path: string; tags: string | SEOTagOptions }[];
  template?: string; // path to template.html (defaults to project root)
  dist?: string; // path to dist directory (defaults to ./dist)
  render?: (route: { path: string; tags: string | SEOTagOptions }) => string; // custom HTML renderer
}

export interface SEOTagOptions {
  title: string;
  description: string;
  author?: string;
  url?: string;
  image?: string;
  keywords?: string;
  canonical?: string;
  robots?: string;
  ampUrl?: string; // Optional AMP version
  schema?: Record<string, unknown>; // Optional structured data (JSON-LD)
}

/**
 * Generate SEO meta tags and optional structured data as a string.
 * Works in Node.js, SSR, or prerender environments.
 */
export function generateSEOTags({
  title,
  description,
  author = "Unknown",
  url = "",
  image = "",
  keywords = "",
  canonical,
  robots = "index, follow",
  ampUrl,
  schema,
}: SEOTagOptions): string {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedAuthor = escapeHtml(author);

  let tags = `
<title>${escapedTitle}</title>
<meta name="description" content="${escapedDescription}">
<meta name="author" content="${escapedAuthor}">
<meta name="keywords" content="${escapeHtml(keywords)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="${robots}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
${ampUrl ? `<link rel="amphtml" href="${escapeHtml(ampUrl)}">` : ""}

<!-- Open Graph -->
<meta property="og:title" content="${escapedTitle}">
<meta property="og:description" content="${escapedDescription}">
<meta property="og:type" content="website">
${url ? `<meta property="og:url" content="${escapeHtml(url)}">` : ""}
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapedTitle}">
<meta name="twitter:description" content="${escapedDescription}">
${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
`.trim();

  if (schema) {
    const schemaJson = JSON.stringify(schema, null, 2);
    tags += `

<!-- Structured Data -->
<script type="application/ld+json">
${schemaJson}
</script>`;
  }

  return tags;
}

/** Escape special HTML characters to prevent injection */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function prerenderStaticPlugin(
  options: PrerenderOptions
): Plugin {
  const {
    routes,
    template = path.resolve(process.cwd(), "template.html"),
    dist = path.resolve(process.cwd(), "dist"),
    render = () =>
      "<p style='height: 100vh ; width: 100vw; text-align: center'>hello world</p>", //  placeholder render function
  } = options;

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
    apply: "build" as const,

    closeBundle() {
      const htmlPath = path.join(dist, "index.html");

      if (!fs.existsSync(htmlPath)) {
        console.warn("Missing index.html — skipping prerender");
        return;
      }

      if (!fs.existsSync(template)) {
        console.warn(
          `Missing template file at ${template} — skipping prerender`
        );
        console.log("Creating a default template.html file...");
        const defaultTemplate = `<!DOCTYPE html>
                                <html lang="en">
                                  <head>
                                    <meta charset="UTF-8" />
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                                    %LINKS%
                                    <title>%TITLE%</title>
                                  </head>
                                  <body>
                                    <div id="root">%APP%</div>
                                  </body>
                                </html>
                                `;
        fs.writeFileSync(template, defaultTemplate);
        console.log(`✅ Created default template at ${template}`);
      }
      console.log("Running prerender-static plugin...");

      const html = fs.readFileSync(htmlPath, "utf8");

      // extract scripts and links
      const scriptRegex = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
      const linkRegex = /<link\b[^>]*>/gi;

      let scriptTags: string[] = html.match(scriptRegex) || [];
      let linkTags: string[] = html.match(linkRegex) || [];

      scriptTags = scriptTags.map((tag) => updatePathAttribute(tag, "src"));
      linkTags = linkTags.map((tag) => updatePathAttribute(tag, "href"));

      const allTags = [...scriptTags, ...linkTags];
      const templateHtml = fs.readFileSync(template, "utf-8");

      for (const route of routes) {
        const appHtml = render(route); // dynamic rendering callback
        const tags =
          typeof route.tags === "string"
            ? route.tags
            : route.tags
            ? generateSEOTags(route.tags)
            : "";

        const finalHtml = templateHtml
          .replace(
            "%TITLE%",
            route.tags && typeof route.tags !== "string"
              ? route.tags.title
              : "Untitled"
          )
          .replace("%APP%", appHtml)
          .replace("%LINKS%", [...allTags].join("\n") + "\n" + tags);

        const filePath =
          route.path === "/" ? "/index.html" : `${route.path}/index.html`;
        const fullPath = path.join(dist, filePath);

        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, finalHtml);
        console.log(`✅ Generated ${filePath}`);
      }

      console.log("🏁 Prerender complete!");
    },
  };
}
