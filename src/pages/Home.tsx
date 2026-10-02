import Footer from "@/components/Footer";
import {
  animate,
  createScope,
  createTimeline,
  Scope,
  spring,
  stagger,
} from "animejs";
import {
  ArrowRight,
  Bot,
  Image,
  MessageCircle,
  Mic,
  Settings,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

type Probe = { gpu: string; online: boolean };

// Live check of what this browser can run. Runs in an effect so SSG output stays static.
function useProbe(): Probe | null {
  const [probe, setProbe] = useState<Probe | null>(null);
  useEffect(() => {
    const gpuApi = (
      navigator as unknown as {
        gpu?: {
          requestAdapter: () => Promise<{
            info?: { vendor?: string; architecture?: string };
          } | null>;
        };
      }
    ).gpu;
    const set = (gpu: string) => setProbe({ gpu, online: navigator.onLine });
    if (!gpuApi) set("Not available in this browser");
    else
      gpuApi
        .requestAdapter()
        .then((a) =>
          set(
            a
              ? [a.info?.vendor, a.info?.architecture]
                  .filter(Boolean)
                  .join(" ") || "Available"
              : "No adapter found",
          ),
        )
        .catch(() => set("Blocked"));
    const sync = () => setProbe((p) => p && { ...p, online: navigator.onLine });
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return probe;
}

function Home() {
  const probe = useProbe();
  const ready = !!probe && !/^(Not|No|Blocked)/.test(probe.gpu);

  const heartGrid = [
    [
      { heart: 0, circle: 1 },
      { heart: 1, circle: 2 },
      { heart: 1, circle: 3 },
      { heart: 0, circle: 4 },
      { heart: 1, circle: 3 },
      { heart: 1, circle: 2 },
      { heart: 0, circle: 1 },
    ],
    [
      { heart: 1, circle: 2 },
      { heart: 1, circle: 3 },
      { heart: 1, circle: 4 },
      { heart: 1, circle: 5 },
      { heart: 1, circle: 4 },
      { heart: 1, circle: 3 },
      { heart: 1, circle: 2 },
    ],
    [
      { heart: 1, circle: 3 },
      { heart: 1, circle: 4 },
      { heart: 1, circle: 5 },
      { heart: 1, circle: 6 },
      { heart: 1, circle: 5 },
      { heart: 1, circle: 4 },
      { heart: 1, circle: 3 },
    ],
    [
      { heart: 1, circle: 4 },
      { heart: 1, circle: 5 },
      { heart: 1, circle: 6 },
      { heart: 1, circle: 7 },
      { heart: 1, circle: 6 },
      { heart: 1, circle: 5 },
      { heart: 1, circle: 4 },
    ],
    [
      { heart: 0, circle: 3 },
      { heart: 1, circle: 4 },
      { heart: 1, circle: 5 },
      { heart: 1, circle: 6 },
      { heart: 1, circle: 5 },
      { heart: 1, circle: 4 },
      { heart: 0, circle: 3 },
    ],
    [
      { heart: 0, circle: 2 },
      { heart: 0, circle: 3 },
      { heart: 1, circle: 4 },
      { heart: 1, circle: 5 },
      { heart: 1, circle: 4 },
      { heart: 0, circle: 3 },
      { heart: 0, circle: 2 },
    ],
    [
      { heart: 0, circle: 1 },
      { heart: 0, circle: 2 },
      { heart: 0, circle: 3 },
      { heart: 1, circle: 4 },
      { heart: 0, circle: 3 },
      { heart: 0, circle: 2 },
      { heart: 0, circle: 1 },
    ],
  ];

  const root = useRef(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    scope.current = createScope({ root }).add(() => {
      const tl = createTimeline({
        defaults: { duration: 750 },
        loop: true,
      });

      animate(".circle-7", {
        rotate: { to: 360, ease: "linear" },
        loop: true,
        duration: 1000,
      });

      tl.label("heartBeat")
        .add(
          ".circle-7",
          {
            scale: [
              { to: 7, ease: "inOut(3)" },
              { to: 3, ease: spring({ bounce: 0.5 }) },
            ],
            opacity: [
              { to: 1, ease: "inOut(3)" },
              { to: 0.7, ease: spring({ bounce: 0.5 }) },
            ],
          },
          0,
        )
        .add(
          ".circle-6",
          {
            scale: [
              { to: 3, ease: "inOut(3)" },
              { to: 1, ease: spring({ bounce: 0.5 }) },
            ],
            opacity: [
              { to: 1, ease: "inOut(3)" },
              { to: 0, ease: spring({ bounce: 0.5 }) },
            ],
            rotate: { to: 360, ease: "inOut(3)" },
          },
          100,
        )
        .add(
          ".circle-5",
          {
            scale: [
              { to: 4, ease: "inOut(3)" },
              { to: 1, ease: spring({ bounce: 0.5 }) },
            ],
            opacity: [
              { to: 1, ease: "inOut(3)" },
              { to: 0, ease: spring({ bounce: 0.5 }) },
            ],
            rotate: { to: 360, ease: "inOut(3)" },
          },
          200,
        )
        .add(
          ".circle-4",
          {
            scale: [
              { to: 5, ease: "inOut(3)" },
              { to: 1, ease: spring({ bounce: 0.5 }) },
            ],
            opacity: [
              { to: 1, ease: "inOut(3)" },
              { to: 0, ease: spring({ bounce: 0.5 }) },
            ],
            rotate: { to: 360, ease: "inOut(3)" },
          },
          300,
        )
        .add(
          ".circle-3",
          {
            scale: [
              { to: 6, ease: "inOut(3)" },
              { to: 1, ease: spring({ bounce: 0.5 }) },
            ],
            opacity: [
              { to: 1, ease: "inOut(3)" },
              { to: 0, ease: spring({ bounce: 0.5 }) },
            ],
            rotate: { to: 360, ease: "inOut(3)" },
          },
          400,
        )
        .add(
          ".circle-2",
          {
            scale: [
              { to: 7, ease: "inOut(3)" },
              { to: 1, ease: spring({ bounce: 0.5 }) },
            ],
            opacity: [
              { to: 1, ease: "inOut(3)" },
              { to: 0, ease: spring({ bounce: 0.5 }) },
            ],
            rotate: { to: 360, ease: "inOut(3)" },
          },
          500,
        )
        .add(
          ".circle-1",
          {
            scale: [
              { to: 8, ease: "inOut(3)" },
              { to: 1, ease: spring({ bounce: 0.5 }) },
            ],
            opacity: [
              { to: 1, ease: "inOut(3)" },
              { to: 0, ease: spring({ bounce: 0.5 }) },
            ],
            rotate: { to: 360, ease: "inOut(3)" },
          },
          600,
        );
    });

    animate(".text-container", {
      y: [-200, 0],
      opacity: [0, 1],
      delay: stagger(100),
      duration: stagger(200, { start: 500 }),
    });
    return () => scope.current?.revert();
  }, []);

  const apps = [
    {
      title: "AI Chat",
      description:
        "Local LLM chat interface with WebGPU acceleration. Chat with multiple AI models running entirely in your browser.",
      icon: MessageCircle,
      route: "/chat",
      features: [
        "WebGPU Accelerated",
        "Multiple Models",
        "Local Processing",
        "Session Management",
      ],
    },
    {
      title: "Text-to-Speech",
      description:
        "Browser-based TTS using ONNX Runtime and WebGPU. Convert text to natural-sounding speech instantly.",
      icon: Mic,
      route: "/tts-demo",
      features: [
        "Real-time Synthesis",
        "Multiple Voices",
        "WebGPU Optimized",
        "Audio Playback",
      ],
    },
    {
      title: "Hugging Face Chat",
      description:
        "Interface for interacting with Hugging Face models. Access a wide range of pre-trained AI models.",
      icon: Bot,
      route: "/huggingface-chat",
      features: [
        "Transformers.js",
        "Pre-trained Models",
        "Chat Interface",
        "Model Variety",
      ],
    },
    {
      title: "Background Remover",
      description:
        "AI-powered image background removal. Process images locally with advanced AI models for instant results.",
      icon: Image,
      route: "/bg-remover",
      features: [
        "Instant Processing",
        "Local AI",
        "Download Results",
        "High Quality",
      ],
    },
  ];

  return (
    <div
      ref={root}
      className="pt-16 md:pt-24 min-h-screen relative overflow-x-hidden"
    >
      {/* Ambient glow: single soft coral wash, no gradient fade */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 size-[300px] md:size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/15 blur-[90px] md:blur-3xl" />
      </div>

      {/* Hero Section */}
      <div className="text-container px-6 mb-12 md:mb-20">
        <h1 className="text-5xl md:text-7xl font-semibold text-center mb-5 tracking-tighter leading-[1.02]">
          The AI Hub
        </h1>
        <p className="text-center text-muted-foreground text-base md:text-xl max-w-2xl mx-auto leading-relaxed">
          A collection of privacy-first, browser-native AI experiences powered
          by modern web technologies.
        </p>
      </div>

      {/* Live browser capability readout */}
      <dl className="text-container mx-auto mb-10 max-w-md rounded-md border bg-card p-4 font-mono text-sm">
        <div className="flex justify-between gap-4 border-b pb-2">
          <dt className="text-muted-foreground">Your GPU</dt>
          <dd className="text-right">{probe ? probe.gpu : "Checking…"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b py-2">
          <dt className="text-muted-foreground">Network</dt>
          <dd>
            {probe ? (probe.online ? "Connected" : "Offline") : "Checking…"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 pt-2">
          <dt className="text-muted-foreground">Ready to run models</dt>
          <dd className={ready ? "font-medium text-primary" : "font-medium"}>
            {probe ? (ready ? "Yes" : "Limited") : "…"}
          </dd>
        </div>
      </dl>

      {/* Animated Heart/Gear - Scaled for smaller screens */}
      <div className="flex justify-center items-center mt-4 mb-12 md:mt-8 md:mb-16">
        <div className="scale-90 sm:scale-100 origin-center">
          {heartGrid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, cellIndex) =>
                cell.heart === 1 ? (
                  <div
                    key={cellIndex}
                    className="w-8 h-8 flex items-center justify-center"
                  >
                    <div
                      className={`w-3 h-3 rounded-2xl heart circle-${cell.circle} opacity-[0.01]`}
                    >
                      <Settings className="w-3 h-3 gear stroke-primary mix-blend-plus-darker" />
                    </div>
                  </div>
                ) : (
                  <div key={cellIndex} className="square w-8 h-8"></div>
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Apps Grid */}
      <div className="container mx-auto px-4 pb-16 md:pb-20">
        <div className="text-center mb-10 md:mb-14 text-container px-2">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-3 md:mb-4">
            Explore the apps
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Each application runs fully in your browser, delivering speed,
            privacy, and cutting-edge AI performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-6xl mx-auto">
          {apps.map((app, index) => {
            const Icon = app.icon;
            return (
              <div
                key={app.title}
                style={{ animationDelay: `${index * 80}ms` }}
                className="
              text-container group relative
              rounded-xl border
              bg-card
              p-5 md:p-6
              transition-all duration-300
              hover:-translate-y-0.5
              hover:border-primary/40
              hover:shadow-[0_12px_32px_-12px_color-mix(in_oklab,var(--primary)_35%,transparent)]
              animate-in fade-in slide-in-from-bottom-4
              active:scale-[0.98] md:active:scale-100
            "
              >
                <div className="relative flex flex-col sm:flex-row items-start gap-4 md:gap-5">
                  {/* Icon Container */}
                  <div
                    className="
                  p-3 rounded-lg
                  bg-primary/10
                  ring-1 ring-primary/20
                  group-hover:ring-primary/40
                  transition-all
                "
                  >
                    <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">
                      {app.title}
                    </h3>

                    <p className="text-sm md:text-base text-muted-foreground mb-4 leading-relaxed">
                      {app.description}
                    </p>

                    {/* Features - Denser on mobile */}
                    <p className="mb-5 font-mono text-xs text-muted-foreground">
                      {app.features.join(" · ")}
                    </p>

                    {/* CTA */}
                    <Link
                      to={app.route}
                      className="
                    inline-flex items-center gap-2
                    text-primary text-sm md:text-base font-medium
                    relative
                    after:absolute after:left-0 after:-bottom-0.5
                    after:h-px after:w-0 after:bg-primary
                    after:transition-all after:duration-300
                    hover:after:w-full
                  "
                    >
                      Try now
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tech Stack */}
        <div className="mt-16 md:mt-24 text-center text-container px-4">
          <h3 className="text-xl md:text-2xl font-semibold mb-6">Built with</h3>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 max-w-4xl mx-auto font-mono text-xs md:text-sm text-muted-foreground">
            {[
              "React 19",
              "TypeScript",
              "WebGPU",
              "ONNX Runtime",
              "Transformers.js",
              "Tailwind CSS",
              "Vite",
              "Zustand",
            ].map((tech) => (
              <span
                key={tech}
                className="transition-colors hover:text-foreground"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
export default Home;
