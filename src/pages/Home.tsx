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
    <div ref={root} className="pt-20 min-h-screen">
      {/* Hero Section */}
      <div className="text-container">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
          The AI Hub
        </h1>
        <p className="text-center text-muted-foreground text-lg max-w-2xl mx-auto">
          A showcase of cutting-edge AI applications running entirely in your
          browser
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
                      <Settings className="w-3 h-3 gear stroke-red-500 mix-blend-plus-darker" />
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
      <div className="container mx-auto px-4 pb-16">
        <div className="text-center mb-12 text-container">
          <h2 className="text-3xl font-bold mb-4">Explore AI Applications</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Each application demonstrates different AI capabilities, all
            processed locally in your browser for privacy and speed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {apps.map((app, index) => {
            const Icon = app.icon;
            return (
              <div
                key={app.title}
                className="text-container group relative bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{app.title}</h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      {app.description}
                    </p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {app.features.map((feature) => (
                        <span
                          key={feature}
                          className="text-xs px-2 py-1 bg-secondary rounded-full text-secondary-foreground"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <Link
                      to={app.route}
                      className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      Try Now
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tech Stack Section */}
        <div className="mt-16 text-center text-container">
          <h3 className="text-2xl font-bold mb-4">
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
                className="px-4 py-2 bg-muted rounded-full text-sm font-medium"
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
