import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import { KappaMark } from "./kappa-mark";
import { ProductShowcase } from "./product-showcase";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./shadcn/accordion";

import "./landing-soft.css";

// Tilts the round mascot toward the cursor. The pointer sets a target and a
// rAF loop eases the rendered angle toward it, so motion stays smooth.
const MAX_TILT_DEG = 22;
const EASE = 0.12;

// kappa.svg split into depth layers. Each layer shifts by --mx/--my times its
// own depth, so the background recedes while the beak and eyes come forward.
const MascotLayers = () => {
  const clipId = useId();
  return (
    <svg
      aria-hidden="true"
      className="landing-mascot"
      height="500"
      viewBox="0 0 500 500"
      width="500"
      xmlns="http://www.w3.org/2000/svg"
    >
      <clipPath id={clipId}>
        <circle cx="250" cy="250" r="250" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g className="mascot-layer mascot-bg">
          <rect fill="#3F6B55" height="580" width="580" x="-40" y="-40" />
        </g>
        <g className="mascot-layer mascot-beak">
          <path
            d="M105 295C115 280 142 277 168 268C191 260 207 238 224 224C233 217 242 214 250 214C258 214 267 217 276 224C293 238 309 260 332 268C358 277 385 280 395 295C391 319 376 343 354 358C328 376 290 385 250 385C210 385 172 376 146 358C124 343 109 319 105 295Z"
            fill="#E6B62C"
          />
          <path
            className="mascot-mouth"
            d="M107 295C132 311 157 316 182 312C207 308 230 297 250 297C270 297 293 308 318 312C343 316 368 311 393 295C370 316 344 323 318 320C292 317 270 306 250 306C230 306 208 317 182 320C156 323 130 316 107 295Z"
            fill="#4C3323"
          />
        </g>
        <g className="mascot-layer mascot-eyes">
          <path
            className="mascot-eye"
            d="M145 247C156.598 247 166 232.673 166 215C166 197.327 156.598 183 145 183C133.402 183 124 197.327 124 215C124 232.673 133.402 247 145 247Z"
            fill="#1A1A1A"
          />
          <path
            className="mascot-eye"
            d="M355 247C366.598 247 376 232.673 376 215C376 197.327 366.598 183 355 183C343.402 183 334 197.327 334 215C334 232.673 343.402 247 355 247Z"
            fill="#1A1A1A"
          />
        </g>
      </g>
    </svg>
  );
};

const LandingMascot = () => {
  const stageRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (
      !stage ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(pointer: fine)").matches
    ) {
      return;
    }
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;

    const tick = () => {
      current.x += (target.x - current.x) * EASE;
      current.y += (target.y - current.y) * EASE;
      stage.style.setProperty("--tilt-x", `${current.y * -MAX_TILT_DEG}deg`);
      stage.style.setProperty("--tilt-y", `${current.x * MAX_TILT_DEG}deg`);
      stage.style.setProperty("--mx", current.x.toFixed(4));
      stage.style.setProperty("--my", current.y.toFixed(4));
      stage.style.setProperty("--glare-x", `${50 + current.x * 30}%`);
      stage.style.setProperty("--glare-y", `${50 + current.y * 30}%`);
      const settled =
        Math.abs(target.x - current.x) < 0.001 &&
        Math.abs(target.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame) {
        frame = requestAnimationFrame(tick);
      }
    };
    const onMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      // Normalise against the viewport so the tilt responds page-wide.
      target.x = Math.max(-1, Math.min(1, dx / (window.innerWidth / 2)));
      target.y = Math.max(-1, Math.min(1, dy / (window.innerHeight / 2)));
      start();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      start();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span className="landing-mascot-stage" ref={stageRef}>
      <span className="landing-mascot-tilt">
        <MascotLayers />
        <span aria-hidden="true" className="landing-mascot-glare" />
      </span>
    </span>
  );
};

export const LandingSoft = ({
  primaryAction,
}: {
  primaryAction: ReactNode;
}) => (
  <div className="landing-soft">
    <a className="landing-skip" href="#main">
      Skip to content
    </a>
    <header className="landing-nav">
      <nav aria-label="Main navigation" className="landing-container">
        <a aria-label="Kappa home" className="app-wordmark" href="/">
          <KappaMark />
          kappa
        </a>
        <div className="landing-nav-links">
          <a href="#showcase">Preview</a>
          <a href="#faq">FAQ</a>
          <a href="#pricing">Pricing</a>
        </div>
      </nav>
    </header>
    <main id="main">
      <section aria-labelledby="hero-title" className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero-heading">
            <h1 id="hero-title">
              Job matches,
              <span>delivered to you.</span>
            </h1>
            <LandingMascot />
          </div>
          <div className="landing-hero-bottom">
            <p>
              Get notified in Discord when new jobs match your keywords or CV.
              Spend less time checking job sites.
            </p>
            <div className="landing-actions">{primaryAction}</div>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="showcase-title"
        className="landing-section showcase-section"
        id="showcase"
      >
        <div className="landing-container">
          <div className="landing-section-head">
            <h2 id="showcase-title">Get notified while you’re away.</h2>
          </div>
          <ProductShowcase />
        </div>
      </section>
      <section
        aria-labelledby="faq-title"
        className="landing-section faq-section"
        id="faq"
      >
        <div className="landing-container landing-faq-grid">
          <h2 id="faq-title">A few things to know.</h2>
          {/* shadcn Accordion; answers stay in the HTML for search engines. */}
          <Accordion
            className="landing-faq"
            defaultValue={["start"]}
            type="multiple"
          >
            <AccordionItem value="start">
              <AccordionTrigger>How do I start?</AccordionTrigger>
              <AccordionContent forceMount>
                <p>Sign in with Discord and choose your keywords.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cv">
              <AccordionTrigger>Do I need to upload my CV?</AccordionTrigger>
              <AccordionContent forceMount>
                <p>No. CV matching is optional.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="server">
              <AccordionTrigger>Can I use it in a server?</AccordionTrigger>
              <AccordionContent forceMount>
                <p>
                  Yes, if you have manage-server permission. Personal CVs stay
                  out of server matches.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="pause">
              <AccordionTrigger>Can I pause a subscription?</AccordionTrigger>
              <AccordionContent forceMount>
                <p>Yes. You can pause or remove a subscription.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
      <section
        aria-labelledby="pricing-title"
        className="landing-section pricing-section"
        id="pricing"
      >
        <div className="landing-container">
          <div className="pricing-intro">
            <h2 id="pricing-title">Start free. Get more control.</h2>
          </div>
          <div className="pricing-grid">
            <article
              aria-labelledby="free-plan-title"
              className="pricing-offer"
            >
              <div className="pricing-plan-heading">
                <h3 id="free-plan-title">Free</h3>
              </div>
              <p>Job alerts and a web dashboard.</p>
              <ul>
                <li>Personal and server subscriptions</li>
                <li>Optional CV matching</li>
                <li>Pause and manage your alerts</li>
              </ul>
            </article>
            <article
              aria-labelledby="premium-plan-title"
              className="pricing-offer pricing-premium"
            >
              <div className="pricing-plan-heading">
                <h3 id="premium-plan-title">Premium</h3>
                <span className="pricing-plan-status">[Coming Soon]</span>
              </div>
              <p>More ways to receive and personalize your job alerts.</p>
              <ul>
                <li>Subscriptions to multiple channels via webhooks</li>
                <li>Configurable notification times</li>
                <li>Automatic keywords from your CV</li>
              </ul>
            </article>
          </div>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-container">
        <a aria-label="Kappa home" className="app-wordmark" href="/">
          <KappaMark />
          kappa
        </a>
      </div>
    </footer>
  </div>
);
