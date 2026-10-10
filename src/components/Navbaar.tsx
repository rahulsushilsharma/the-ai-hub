import { useTheme } from "@/Theme";
import { Scope, animate, createScope, spring } from "animejs";
import {
  Bot,
  Brain,
  Home,
  ImageIcon,
  Menu,
  MessageCircle,
  Mic,
  Palette,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "./ui/button";

const navItems = [
  { label: "Home", path: "/", icon: <Home className="w-4 h-4" /> },
  {
    label: "AI Chat",
    path: "/chat",
    icon: <MessageCircle className="w-3 h-3 " />,
  },
  {
    label: "Speech (TTS)",
    path: "/tts-demo",
    icon: <Mic className="w-3 h-3" />,
  },
  {
    label: "Supertonic TTS",
    path: "/tts-supertonic",
    icon: <Mic className="w-3 h-3" />,
  },
  {
    label: "hf Chat",
    path: "/huggingface-chat",
    icon: <Bot className="w-3 h-3" />,
  },
  {
    label: "Background Remover",
    path: "/bg-remover",
    icon: <ImageIcon className="w-3 h-3" />,
  },
  {
    label: "Text to Image",
    path: "/agate",
    icon: <Palette className="w-3 h-3" />,
  },
  {
    label: "microGPT",
    path: "/microgpt",
    icon: <Brain className="w-3 h-3" />,
  },
];

function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const root = useRef(null);
  const scope = useRef<Scope | null>(null);
  const circle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scope.current = createScope({ root }).add((self) => {
      if (!self) return;

      self.add("lightTheme", () => {
        animate(".circle", {
          scale: [
            { to: 500, ease: "inOut(3)" },
            { to: 1, ease: "inOut(3)" },
          ],
          duration: 1000,
          onComplete: () => {},
          onUpdate: (anim) => {
            if (anim.progress > 0.5) {
              setTheme("light");
            }
          },
        });
      });

      self.add("darkTheme", () => {
        animate(".circle", {
          scale: [
            { to: 500, ease: "inOut(3)" },
            { to: 1, ease: "inOut(3)" },
          ],

          duration: 1000,
          onComplete: () => {},
          onUpdate: (anim) => {
            if (anim.progress > 0.5) {
              setTheme("dark");
            }
          },
        });
      });
    });
  }, [scope, setTheme]);

  function changeTheme() {
    if (theme === "light") {
      scope.current?.methods.darkTheme();
    } else {
      scope.current?.methods.lightTheme();
    }
  }

  return (
    <>
      <div ref={root} className="relative z-10">
        <Button
          onClick={() => changeTheme()}
          className="z-9 relative"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          {theme === "light" ? <Sun /> : <Moon />}
        </Button>
        <div
          ref={circle}
          className="circle absolute top-3 left-3 w-2 h-2 rounded-full bg-accent-foreground pointer-events-none  transform-gpu "
        ></div>
      </div>
    </>
  );
}
export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const root = useRef(null);
  const scope = useRef<Scope | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    scope.current = createScope({ root }).add((self) => {
      if (!self) return;

      self.add("openNavbar", () => {
        animate(".navbar", {
          x: { to: "5dvw", ease: spring({ bounce: 0.5 }) },
          opacity: { to: 1, ease: "easeInOut", duration: 300 },

          duration: 900,
        });
      });

      self.add("closeNavbar", () => {
        animate(".navbar", {
          x: { to: "-100dvw", ease: spring({ bounce: 0.5 }) },
          opacity: { to: 0, ease: "easeInOut", duration: 300 },

          duration: 900,
        });
      });
      self.add("openButton", () => {
        animate(".openButton", {
          opacity: { to: 0, ease: "linear" },
          duration: 300,
        });
      });

      self.add("closeButton", () => {
        animate(".openButton", {
          opacity: { to: 1, ease: "linear" },
          duration: 300,
        });
      });
    });

    return () => scope.current?.revert();
  }, []);

  useEffect(() => {
    if (isOpen) {
      scope.current?.methods.openNavbar();
      scope.current?.methods.openButton();
    } else {
      scope.current?.methods.closeNavbar();
      scope.current?.methods.closeButton();
    }
  }, [isOpen]);

  return (
    <div ref={root}>
      <Button
        aria-label="Open navigation"
        aria-expanded={isOpen}
        inert={isOpen}
        className="fixed top-3 right-3 z-99 openButton shadow-md"
        onClick={() => setIsOpen((isOpen) => !isOpen)}
        variant="outline"
      >
        <Menu />
      </Button>
      <nav
        aria-label="Main"
        inert={!isOpen}
        className="
     flex gap-1 h-12 items-center px-4 shadow-md fixed top-3 left-0 right-0 z-99 navbar w-[90vw] rounded-md bg-accent
    justify-between
  "
      >
        <div className="flex  items-center gap-1">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              onClick={() => {
                navigate(item.path);
                setIsOpen(false);
              }}
              className={`
  flex items-center justify-center md:justify-start px-2 md:px-3 hover:scale-110 transition-transform
  ${pathname === item.path ? "bg-muted" : ""}
`}
              aria-label={item.label}
              aria-current={pathname === item.path ? "page" : undefined}
              title={item.label}
            >
              {item.icon}

              {/* Hide text on mobile, show on desktop */}
              <span className="hidden md:inline">{item.label}</span>
            </Button>
          ))}
        </div>

        <div className=" flex items-center gap-1  ">
          <ThemeButton />

          <Button
            aria-label="Close navigation"
            onClick={() => setIsOpen(false)}
            variant="ghost"
            className="flex items-center justify-center
    md:justify-start
    gap-0 md:gap-3
    px-3 py-3
    md:py-1
    text-base md:text-sm"
          >
            <X />
          </Button>
        </div>
      </nav>
    </div>
  );
}
