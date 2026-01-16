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
import { useEffect, useRef } from "react";
import { Link } from "react-router";

function Home() {
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
          0
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
          100
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
          200
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
          300
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
          400
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
          500
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
          600
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
    <div ref={root} className="pt-24 min-h-screen relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="absolute inset-0 -z-10">
        <div
          className="
          absolute top-1/2 left-1/2
          w-[600px] h-[600px]
          -translate-x-1/2 -translate-y-1/2
          bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20
          blur-3xl rounded-full
        "
        />
      </div>

      {/* Hero Section */}
      <div className="text-container mb-20">
        <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-6 tracking-tight">
          <span className="bg-gradient-to-br from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            The AI Hub
          </span>
        </h1>
        <p className="text-center text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          A collection of privacy-first, browser-native AI experiences powered
          by modern web technologies.
        </p>
      </div>

      {/* Animated Heart/Gear */}
      <div className="flex justify-center items-center mt-8 mb-16">
        <div className="">
          {heartGrid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, cellIndex) =>
                cell.heart === 1 ? (
                  <div key={cellIndex} className={`w-8 h-8 `}>
                    <div
                      className={`w-3 h-3 rounded-2xl m-auto mt-2 heart circle-${cell.circle}  opacity-[0.01]`}
                    >
                      <Settings className="w-3 h-3 gear stroke-purple-500  mix-blend-plus-darker" />
                    </div>
                  </div>
                ) : (
                  <div key={cellIndex} className={`square w-8 h-8 `}></div>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Apps Grid */}
      <div className="container mx-auto px-4 pb-20">
        <div className="text-center mb-14 text-container">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Explore AI Applications
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Each application runs fully in your browser, delivering speed,
            privacy, and cutting-edge AI performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {apps.map((app, index) => {
            const Icon = app.icon;
            return (
              <div
                key={app.title}
                style={{ animationDelay: `${index * 80}ms` }}
                className="
                text-container group relative
                rounded-2xl border
                bg-background/60 backdrop-blur-xl
                p-6
                transition-all duration-300
                hover:-translate-y-1 hover:shadow-2xl
                hover:border-primary/40
                animate-in fade-in slide-in-from-bottom-4
              "
              >
                {/* Gradient Hover Overlay */}
                <div
                  className="
                  absolute inset-0 rounded-2xl
                  bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10
                  opacity-0 group-hover:opacity-100
                  transition-opacity
                "
                />

                <div className="relative flex items-start gap-5">
                  {/* Icon */}
                  <div
                    className="
                    p-3 rounded-xl
                    bg-gradient-to-br from-primary/20 to-purple-500/20
                    ring-1 ring-primary/20
                    group-hover:ring-primary/40
                    transition-all
                  "
                  >
                    <Icon className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{app.title}</h3>

                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      {app.description}
                    </p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      {app.features.map((feature) => (
                        <span
                          key={feature}
                          className="
                          text-xs px-3 py-1 rounded-full
                          bg-muted/60 backdrop-blur
                          border border-border/50
                        "
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <Link
                      to={app.route}
                      className="
                      inline-flex items-center gap-2
                      text-primary font-medium
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
        <div className="mt-20 text-center text-container">
          <h3 className="text-2xl font-bold mb-6">
            Powered by Modern Web Technologies
          </h3>

          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
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
                className="
                px-4 py-2 rounded-full
                bg-background/70 backdrop-blur
                border border-border/50
                text-sm font-medium
                hover:border-primary/40
                transition-colors
              "
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
