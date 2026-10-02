import Footer from "@/components/Footer";

const sections = [
  {
    title: "What stays on your device",
    body: [
      "Chat messages, uploaded images and typed text are processed in your browser. They are never sent to a server run by this site.",
      "Chat history and chat settings are saved in your browser's local storage. The theme choice is saved there too. Clear your site data to remove them.",
      "Model files are downloaded to your browser cache the first time you load a model. They typically come from Hugging Face. Your IP address and browser details are visible to that host when the download happens.",
    ],
  },
  {
    title: "What is collected",
    body: [
      "This site uses Google Analytics for Firebase to count visits and see which pages are used. It records standard usage data such as pages viewed, approximate location, device and browser type. It does not receive your chats, images or text.",
      "Google may set identifiers in your browser for this purpose. See Google's own privacy policy for how it handles that data.",
    ],
  },
  {
    title: "Third-party requests",
    body: [
      "Fonts load from Google Fonts. The documentation on the Text to speech and Hugging Face chat pages is fetched from GitHub. Links to GitHub and npm open in a new tab and are governed by their own policies.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can block analytics with a content blocker or by disabling cookies and site data for this domain. The apps work without analytics.",
      "To delete saved chats, use the delete button in the chat sidebar or clear site data in your browser settings.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "If this policy changes, the date above changes with it. Questions go to the issue tracker on the project's GitHub repository.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="flex min-h-dvh flex-col pt-16 md:pt-24">
      <div className="container mx-auto max-w-2xl flex-1 px-4 pb-16">
        <h1 className="mb-2 text-4xl font-semibold tracking-tighter md:text-5xl">
          Privacy policy
        </h1>
        <p className="mb-10 font-mono text-xs text-muted-foreground">
          Last updated 2 October 2026
        </p>
        <p className="mb-10 leading-relaxed text-muted-foreground">
          The AI Hub runs its models in your browser. Most of what you do here
          never leaves your device. This page lists the exceptions.
        </p>
        {sections.map((s) => (
          <section key={s.title} className="mb-8">
            <h2 className="mb-3 text-2xl font-semibold tracking-tight">
              {s.title}
            </h2>
            {s.body.map((p) => (
              <p key={p} className="mb-3 leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
        <a
          href="https://github.com/rahulsushilsharma/the-ai-hub/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Open an issue on GitHub
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <Footer />
    </div>
  );
}
