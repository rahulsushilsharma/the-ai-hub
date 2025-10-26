import {
  animate,
  createScope,
  createTimeline,
  Scope,
  spring,
  stagger,
} from "animejs";
import { Settings } from "lucide-react";
import { useEffect, useRef } from "react";

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

      tl.label("heartBeat")
        .add(
          ".circle-7",
          {
            scale: [
              { to: 5, ease: "inOut(3)" },
              { to: 1, ease: spring({ bounce: 0.5 }) },
            ],
            opacity: [
              { to: 1, ease: "inOut(3)" },
              { to: 0.7, ease: spring({ bounce: 0.5 }) },
            ],
            rotate: { to: 360, ease: "inOut(3)" },
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
              { to: 0.1, ease: spring({ bounce: 0.5 }) },
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
              { to: 0.1, ease: spring({ bounce: 0.5 }) },
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
              { to: 0.1, ease: spring({ bounce: 0.5 }) },
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
              { to: 0.1, ease: spring({ bounce: 0.5 }) },
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
              { to: 0.1, ease: spring({ bounce: 0.5 }) },
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
              { to: 0.1, ease: spring({ bounce: 0.5 }) },
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

  return (
    <div ref={root} className="pt-20">
      <div className="text-container">
        <h1 className="text-3xl font-bold text-center"> The Ai Hub</h1>
      </div>

      <div className="flex justify-center items-center mt-10 flex-col ">
        <div className="">
          {heartGrid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, cellIndex) =>
                cell.heart === 1 ? (
                  <div key={cellIndex} className={`w-8 h-8 `}>
                    <div
                      className={`w-3 h-3 rounded-2xl m-auto mt-2 heart circle-${cell.circle}  opacity-[0.1]`}
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
        <div className="mt-10 text-center max-w-md text-container">
          <p className="">Welcome to the Ai Hub, the heart of my ai projects</p>
        </div>
      </div>
    </div>
  );
}
export default Home;
