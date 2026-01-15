import { animate, createScope, Scope } from "animejs";
import { Heart } from "lucide-react";
import { useEffect, useRef } from "react";

function Footer() {
  const root = useRef(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    scope.current = createScope({ root }).add(() => {
      animate(".heart-icon", {
        scale: [
          { to: 1.2, ease: "inOut(2)" },
          { to: 1, ease: "inOut(2)" },
        ],
        duration: 1500,
        loop: true,
      });

      animate(".footer-text", {
        y: [20, 0],
        opacity: [0, 1],
        duration: 800,
        delay: 200,
      });
    });

    return () => scope.current?.revert();
  }, []);

  return (
    <footer
      ref={root}
      className="mt-auto border-t bg-background/80 backdrop-blur-sm"
    >
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="footer-text flex items-center gap-2 text-muted-foreground">
            <span>Made with</span>
            <Heart className="heart-icon w-4 h-4 text-red-500 fill-red-500" />
            <span>by</span>
            <a
              href="https://github.com/rahulsushilsharma"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Rahul Sharma
            </a>
          </div>
          <div className="footer-text text-xs text-muted-foreground">
            © {new Date().getFullYear()} The AI Hub. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
