import React, { useState, useEffect, useRef } from "react";

const PAGE_SIZE = 12;

// Resolve a manifest path against the site base, so subpath hosting works.
// Older manifest entries with a leading slash ("/output/x.jpg") still work.
const resolveUrl = (p) =>
  p ? `${import.meta.env.BASE_URL}${String(p).replace(/^\/+/, "")}` : "";

const SITE_TITLE = "The Infinite Buddha";

// Each piece has its own page next to index.html ("/buddha-20261023-085429"),
// written at build time with that piece's link-preview tags (see vite.config.js).
const siteRoot = () => new URL(".", window.location.href);

const pieceUrl = (id) => new URL(encodeURIComponent(id), siteRoot()).href;

const pieceIdFromPath = () => {
  const m = /\/([\w-]+?)(?:\.html)?\/?$/.exec(window.location.pathname);
  return m && m[1] !== "index" ? decodeURIComponent(m[1]) : null;
};

const SWIPE_MIN_PX = 50;

const altText = (art) => {
  const prompt = art.prompt ? `: ${art.prompt}` : "";
  const text = `${art.title}${prompt}`;
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
};

// Format a manifest date ("YYYY-MM-DD") as "Oct 22, 2026" without timezone shifts.
const formatDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ""));
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Today's date in UTC, the same calendar the generator uses for manifest dates.
const todayKey = () => new Date().toISOString().slice(0, 10);

function DateBadge({ date, className = "" }) {
  const label = formatDate(date);
  if (!label) return null;
  return (
    <time
      dateTime={date}
      className={`absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none whitespace-nowrap bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded text-buddha-gold text-[10px] font-mono tracking-widest uppercase ${className}`}
    >
      {label}
    </time>
  );
}

function CloseIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ direction }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

export default function App() {
  const [artworks, setArtworks] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE * 2);
  const [selectedArt, setSelectedArt] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [copyState, setCopyState] = useState("idle"); // idle | copied | failed
  const [linkState, setLinkState] = useState("idle"); // idle | copied | failed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sentinelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const touchStartRef = useRef(null);
  const copyTimersRef = useRef({});

  const modalOpen = Boolean(selectedArt) || isAboutOpen;

  // Fetch manifest data
  useEffect(() => {
    const controller = new AbortController();
    fetch(resolveUrl("data/manifest.json"), {
      cache: "no-cache",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Manifest is not a list");
        setArtworks(data);
        // Open the piece a shared link points to, if it exists.
        const wanted = pieceIdFromPath();
        const match = wanted && data.find((a) => a.id === wanted);
        if (match) setSelectedArt(match);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to load manifest:", err);
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Infinite scroll via a sentinel below the grid
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, artworks.length));
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [artworks.length, visibleCount, loading]);

  // Modal behavior: Escape to close, lock page scroll, restore focus
  useEffect(() => {
    if (!modalOpen) return undefined;

    lastFocusedRef.current = document.activeElement;
    closeBtnRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        setSelectedArt(null);
        setIsAboutOpen(false);
        return;
      }
      // Keep Tab focus inside the open dialog instead of the page behind it.
      if (e.key !== "Tab") return;
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;
      const focusable = [
        ...dialog.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'),
      ].filter((el) => !el.disabled && el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocusedRef.current?.focus?.();
    };
  }, [modalOpen]);

  // Keep the address bar pointing at the open piece, so it can be copied or bookmarked.
  // Skipped when the manifest failed to load, so a shared piece link survives a reload.
  useEffect(() => {
    if (loading || error) return;
    const url = selectedArt ? pieceUrl(selectedArt.id) : siteRoot().href;
    if (url !== window.location.href) window.history.replaceState(null, "", url);
    document.title = selectedArt ? `${selectedArt.title} · ${SITE_TITLE}` : `${SITE_TITLE} | Generative Art Feed`;
  }, [selectedArt, loading, error]);

  // Stepping to the first or last piece removes the Newer/Older button that had focus;
  // move focus back into the dialog so keyboard users are not dropped onto the page.
  useEffect(() => {
    if (selectedArt && document.activeElement === document.body) closeBtnRef.current?.focus();
  }, [selectedArt]);

  // Move through the archive from inside the modal. Artworks are newest first,
  // so +1 is the older piece (to the right in the grid) and -1 the newer one.
  const stepPiece = (offset) => {
    setSelectedArt((current) => {
      if (!current) return current;
      const i = artworks.findIndex((a) => a.id === current.id);
      return artworks[i + offset] || current;
    });
    setCopyState("idle");
    setLinkState("idle");
  };

  useEffect(() => {
    if (!selectedArt) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") stepPiece(-1);
      if (e.key === "ArrowRight") stepPiece(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [Boolean(selectedArt), artworks]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSwipeStart = (e) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onSwipeEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Only count clearly horizontal swipes, so scrolling the details still works.
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      stepPiece(dx < 0 ? 1 : -1);
    }
  };

  // Clear any pending "reset the button label" timers when the app unmounts.
  useEffect(() => {
    const timers = copyTimersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const copyText = async (text, setState, timerKey) => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    // Restart the timer on each click, so rapid clicks do not flicker the label.
    clearTimeout(copyTimersRef.current[timerKey]);
    copyTimersRef.current[timerKey] = setTimeout(() => setState("idle"), 2000);
  };

  // Phones get the native share sheet; desktops copy the link.
  const sharePiece = async (art) => {
    const url = pieceUrl(art.id);
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: `${art.title} · The Infinite Buddha`, url });
      } catch {
        // Share sheet dismissed - nothing to do.
      }
      return;
    }
    copyText(url, setLinkState, "link");
  };

  if (loading) {
    return (
      <div
        role="status"
        className="min-h-screen bg-buddha-dark flex items-center justify-center text-gray-400 font-mono text-sm tracking-widest"
      >
        LOADING SANCTUARY...
      </div>
    );
  }

  const heroPiece = artworks.length > 0 ? artworks[0] : null;
  const gridPieces = artworks.length > 1 ? artworks.slice(1, visibleCount + 1) : [];
  const hasMore = visibleCount + 1 < artworks.length;

  const copyLabel =
    copyState === "copied"
      ? "Prompt Copied to Clipboard"
      : copyState === "failed"
      ? "Copy failed - select the text manually"
      : "Copy Full Prompt";

  const linkLabel =
    linkState === "copied"
      ? "Link Copied to Clipboard"
      : linkState === "failed"
      ? "Copy failed - copy the address bar instead"
      : "Share This Buddha";

  const selectedIndex = selectedArt ? artworks.findIndex((a) => a.id === selectedArt.id) : -1;
  const hasNewer = selectedIndex > 0;
  const hasOlder = selectedIndex >= 0 && selectedIndex < artworks.length - 1;
  const navBtnClass =
    "absolute top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-gray-200 hover:text-buddha-gold p-3 rounded-full border border-[#272b36] transition-colors";

  return (
    <div className="min-h-screen bg-buddha-dark text-gray-100 flex flex-col selection:bg-buddha-gold selection:text-black">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-buddha-dark/80 border-b border-[#1f232d]">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="font-medium tracking-wider text-xs uppercase text-gray-200">
              The Infinite Buddha
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsAboutOpen(true)}
            className="-mr-3 min-h-[44px] min-w-[44px] px-3 text-[11px] font-mono tracking-widest uppercase text-gray-400 hover:text-buddha-gold transition-colors bg-transparent border-none cursor-pointer"
          >
            About
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {error && (
          <div role="alert" className="max-w-3xl mx-auto px-6 py-24 text-center font-mono text-sm text-gray-400">
            Could not load the gallery ({error}). Please try again later.
          </div>
        )}

        {!error && !heroPiece && (
          <div className="max-w-3xl mx-auto px-6 py-24 text-center font-mono text-sm text-gray-400">
            The sanctuary is quiet. No pieces have been generated yet.
          </div>
        )}

        {/* Hero Showcase */}
        {heroPiece && (
          <section id="hero" className="max-w-3xl mx-auto px-6 pt-8 pb-2">
            <button
              type="button"
              onClick={() => setSelectedArt(heroPiece)}
              aria-label={`View ${heroPiece.title}`}
              className="block w-full aspect-square overflow-hidden bg-buddha-card rounded-lg border border-[#1f232d] shadow-2xl cursor-pointer group relative transition-all duration-300 hover:border-buddha-gold focus-visible:border-buddha-gold focus-visible:outline-none hover:shadow-[0_0_25px_rgba(212,175,55,0.3)]"
            >
              <div className="absolute top-4 left-4 z-20 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-md border border-buddha-gold/40 text-buddha-gold text-xs font-mono tracking-widest uppercase shadow-lg">
                {heroPiece.date === todayKey()
                  ? "Buddha generated Today"
                  : `Buddha generated ${formatDate(heroPiece.date) || "Today"}`}
              </div>

              <img
                src={resolveUrl(heroPiece.displayUrl || heroPiece.imageUrl)}
                alt={altText(heroPiece)}
                decoding="async"
                fetchpriority="high"
                className="w-full h-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-105"
              />
            </button>
          </section>
        )}

        {/* Zero-space 1:1 square grid (archive) */}
        <section id="gallery" className="w-full mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0">
            {gridPieces.map((art) => (
              <button
                type="button"
                key={art.id}
                onClick={() => setSelectedArt(art)}
                aria-label={`View ${art.title}`}
                className="block w-full relative aspect-square overflow-hidden bg-buddha-card border border-[#1f232d] group cursor-pointer transition-all duration-300 hover:border-buddha-gold focus-visible:border-buddha-gold focus-visible:outline-none hover:shadow-[0_0_25px_rgba(212,175,55,0.3)] z-10 hover:z-20 focus-visible:z-20"
              >
                <img
                  src={resolveUrl(art.thumbUrl || art.imageUrl)}
                  srcSet={
                    art.thumbUrl && art.displayUrl
                      ? `${resolveUrl(art.thumbUrl)} 640w, ${resolveUrl(art.displayUrl)} 1024w`
                      : undefined
                  }
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                  alt={altText(art)}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                />
                <DateBadge date={art.date} />
              </button>
            ))}
          </div>
          {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
        </section>
      </main>

      {/* Modal View for Artwork Inspection */}
      {selectedArt && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setSelectedArt(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Artwork details: ${selectedArt.title}`}
            className="bg-buddha-card border border-[#1f232d] rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl grid grid-cols-1 md:grid-cols-2 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              ref={closeBtnRef}
              onClick={() => setSelectedArt(null)}
              aria-label="Close"
              className="absolute top-4 right-4 z-20 bg-[#1f232d] hover:bg-[#272b36] text-gray-300 hover:text-buddha-gold p-3 rounded-full border border-[#272b36] transition-colors"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
            <div
              className="bg-black flex items-center justify-center aspect-square relative"
              onTouchStart={onSwipeStart}
              onTouchEnd={onSwipeEnd}
            >
              <DateBadge date={selectedArt.date} className="top-3 text-xs" />
              <img
                src={resolveUrl(selectedArt.displayUrl || selectedArt.imageUrl)}
                alt={altText(selectedArt)}
                className="w-full h-full object-cover"
              />
              {hasNewer && (
                <button
                  type="button"
                  onClick={() => stepPiece(-1)}
                  aria-label="Newer Buddha"
                  title="Newer (←)"
                  className={`${navBtnClass} left-3`}
                >
                  <ChevronIcon direction="left" />
                </button>
              )}
              {hasOlder && (
                <button
                  type="button"
                  onClick={() => stepPiece(1)}
                  aria-label="Older Buddha"
                  title="Older (→)"
                  className={`${navBtnClass} right-3`}
                >
                  <ChevronIcon direction="right" />
                </button>
              )}
            </div>
            <div className="p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-1">Title</h2>
                  <p className="text-gray-100 text-lg font-serif">{selectedArt.title}</p>
                </div>
                <div>
                  <h2 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-1">Generation Prompt</h2>
                  <p className="text-gray-300 text-xs font-mono bg-buddha-dark p-3 rounded-lg border border-[#1f232d] leading-relaxed max-h-40 overflow-y-auto">
                    {selectedArt.prompt}
                  </p>
                </div>
                {Array.isArray(selectedArt.tags) && selectedArt.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {selectedArt.tags.map((tag) => (
                      <li
                        key={tag}
                        className="text-[10px] font-mono uppercase tracking-wider text-gray-400 border border-[#272b36] rounded-full px-2.5 py-1"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => sharePiece(selectedArt)}
                  className="w-full py-3 px-4 bg-buddha-gold/10 hover:bg-buddha-gold/20 text-buddha-gold text-xs font-mono tracking-wider uppercase rounded-lg transition-colors flex items-center justify-center space-x-2 border border-buddha-gold/40"
                >
                  <span>{linkLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyText(selectedArt.prompt, setCopyState, "prompt")}
                  className="w-full py-3 px-4 bg-[#1f232d] hover:bg-[#272b36] text-gray-200 text-xs font-mono tracking-wider uppercase rounded-lg transition-colors flex items-center justify-center space-x-2 border border-[#272b36]"
                >
                  <span>{copyLabel}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {isAboutOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setIsAboutOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="About Infinite Buddha"
            className="bg-buddha-card border border-[#1f232d] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              ref={closeBtnRef}
              onClick={() => setIsAboutOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 z-20 bg-[#1f232d] hover:bg-[#272b36] text-gray-300 p-3 rounded-full transition-colors"
            >
              <CloseIcon />
            </button>

            <div className="space-y-2">
              <h2 className="text-xl font-serif text-gray-100 tracking-wide">About The Infinite Buddha</h2>
              <p className="text-xs font-mono text-buddha-gold tracking-widest uppercase">A new Buddha Every Day</p>
            </div>

            <p className="text-sm text-gray-300 font-light leading-relaxed">
              The Infinite Buddha is a generative art project by JeffreyAiFudenna. Every night, a script combines a randomly chosen subject, setting and style into a prompt, and Google's Gemini AI renders a new Buddha. No two are alike.
            </p>
            <p className="text-sm text-gray-300 font-light leading-relaxed">
              It comes from a very human hope: that if we can create anything with AI, we choose to create good and prosperous things for everyone to enjoy.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="w-full py-3 px-4 bg-[#1f232d] hover:bg-[#272b36] text-gray-200 text-xs font-mono tracking-wider uppercase rounded-lg transition-colors border border-[#272b36]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-12 px-6 border-t border-[#1f232d] text-xs font-mono text-gray-400">
        <div className="max-w-7xl mx-auto text-center">
          A New Buddha Every Day since October 14, 2026 ·{" "}
          <a
            href="https://github.com/jeffreyaifudenna/infinite-buddha"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 underline decoration-[#272b36] underline-offset-4 hover:text-buddha-gold hover:decoration-buddha-gold transition-colors"
          >
            Open Source
          </a>
          {" "}·{" "}
          <a
            href="https://jeffrey-ai-portfolio.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 underline decoration-[#272b36] underline-offset-4 hover:text-buddha-gold hover:decoration-buddha-gold transition-colors"
          >
            Jeffrey-Ai-Portfolio
          </a>
        </div>
      </footer>
    </div>
  );
}