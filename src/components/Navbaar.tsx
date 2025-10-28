import { useTheme } from "@/Theme";
import { Scope, animate, createScope, spring } from "animejs";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";

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
    console.log("change theme");
    if (theme === "light") {
      //   setTheme("dark");
      scope.current?.methods.darkTheme();
    } else {
      //   setTheme("light");
      scope.current?.methods.lightTheme();
    }
  }

  return (
    <>
      <div ref={root} className="relative z-10">
        <Button onClick={() => changeTheme()} className="z-9 relative">
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
  const root = useRef(null);
  const scope = useRef<Scope | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    scope.current = createScope({ root }).add((self) => {
      if (!self) return;

      self.add("openNavbar", () => {
        animate(".navbar", {
          x: { to: "15dvw", ease: spring({ bounce: 0.5 }) },
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
        className="fixed top-3 right-3 z-99 openButton shadow-md"
        onClick={() => setIsOpen((isOpen) => !isOpen)}
        variant="outline"
      >
        <Menu />
      </Button>
      <nav className="flex gap-1 h-12 items-center px-4 shadow-md fixed top-3 left-0 right-0 z-99 navbar w-[70vw] rounded-md bg-accent">
        <Button className="p-0.5" onClick={() => navigate("/")} variant="link">
          Home
        </Button>
        <Button
          className="p-0.5"
          onClick={() => navigate("/chat")}
          variant="link"
        >
          Chat
        </Button>
        <Button
          className="p-0.5"
          onClick={() => navigate("/tts-demo")}
          variant="link"
        >
          TTS Demo
        </Button>

        <Button
          className="p-0.5"
          onClick={() => navigate("/huggingface-chat")}
          variant="link"
        >
          huggingface chat
        </Button>
        <Button
          className="ml-auto "
          onClick={() => setIsOpen((isOpen) => !isOpen)}
          variant="outline"
        >
          <X />
        </Button>
        <ThemeButton />
      </nav>
    </div>
  );
}
