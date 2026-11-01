import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { gsap } from "gsap";

// QuizX's dotted wordmark, drawn locally so the feature needs no remote font.
const glyphs = [
  "11110/10001/10001/10001/10101/10010/01101",
  "00000/00000/10001/10001/10001/10011/01101",
  "00100/00000/01100/00100/00100/00100/01110",
  "00000/00000/11111/00010/00100/01000/11111",
  "10001/10001/01010/00100/01010/10001/10001",
];
export function QuizXFeature() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = linkRef.current;
    if (!link) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        link,
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", delay: 0.15 },
      );
      const enter = () => {
        gsap.to(link.querySelector("[data-quizx-arrow]"), {
          x: 2,
          y: -2,
          duration: 0.25,
          ease: "power2.out",
          overwrite: true,
        });
        gsap.fromTo(
          link.querySelector("[data-quizx-sheen]"),
          { xPercent: -120 },
          { xPercent: 500, duration: 0.7, ease: "power2.out", overwrite: true },
        );
      };
      const leave = () => {
        gsap.to(link.querySelector("[data-quizx-arrow]"), {
          x: 0,
          y: 0,
          duration: 0.25,
          overwrite: true,
        });
      };
      link.addEventListener("mouseenter", enter);
      link.addEventListener("focus", enter);
      link.addEventListener("mouseleave", leave);
      link.addEventListener("blur", leave);
      return () => {
        link.removeEventListener("mouseenter", enter);
        link.removeEventListener("focus", enter);
        link.removeEventListener("mouseleave", leave);
        link.removeEventListener("blur", leave);
      };
    });
    return () => media.revert();
  }, []);
  return (
    <a
      ref={linkRef}
      href="https://quizxbit.netlify.app/"
      aria-label="Featured: QuizX quiz and assessment application"
      className="group relative inline-flex max-w-full items-center gap-2 overflow-hidden rounded-xl border border-zinc-300 bg-zinc-950 px-2.5 py-2 text-zinc-50 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span
        data-quizx-sheen
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-[120%] -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      <span className="relative border-r border-zinc-700 pr-2 text-[8px] font-mono uppercase tracking-[0.18em] text-zinc-400">
        Featured
      </span>
      <svg
        viewBox="0 0 60 15"
        className="relative h-5 w-[4.5rem] shrink-0"
        aria-hidden="true"
      >
        {glyphs.flatMap((glyph, letter) =>
          glyph
            .split("/")
            .flatMap((row, y) =>
              [...row].map((dot, x) =>
                dot === "1" ? (
                  <circle
                    key={`${letter}-${y}-${x}`}
                    cx={letter * 12 + x * 2 + 1}
                    cy={y * 2 + 1}
                    r="0.7"
                    fill="currentColor"
                  />
                ) : null,
              ),
            ),
        )}
      </svg>
      <span className="hidden xl:inline text-[9px] text-zinc-400">
        Quiz. Assess. Learn.
      </span>
      <ArrowUpRight
        data-quizx-arrow
        className="relative size-3.5 text-zinc-300"
      />
    </a>
  );
}
