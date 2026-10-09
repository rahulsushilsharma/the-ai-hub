import Footer from "@/components/Footer";
import PageHeader, { PageGlow } from "@/components/PageHeader";
import init from "@/lib/agate/app";
import "@/lib/agate/agate.css";
import markup from "@/lib/agate/markup";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

// The original Agate page (Logolabs/agate-webgpu, MIT) is imperative DOM code; mount it as-is.
export default function Agate() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => (root.current ? init(root.current) : undefined), []);
  return (
    <div className="pt-16 md:pt-24 min-h-screen relative overflow-x-hidden">
      <PageGlow />
      <div className="container max-w-5xl mx-auto px-4">
        <PageHeader
          icon={Sparkles}
          title="Agate"
          blurb="Generate images from text with a small flow model running on your own GPU."
          tags={["Local AI", "WebGPU", "Text-to-image", "Privacy-first"]}
        />
      </div>
      <div ref={root} className="agate" dangerouslySetInnerHTML={{ __html: markup }} />
      <Footer />
    </div>
  );
}
