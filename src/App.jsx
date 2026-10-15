import React, { useState, useEffect, useRef } from "react";

const PAGE_SIZE = 12;

// Resolve a manifest path against the site base, so subpath hosting works.
// Older manifest entries with a leading slash ("/output/x.jpg") still work.
const resolveUrl = (p) =>
  p ? `${import.meta.env.BASE_URL}${String(p).replace(/^\/+/, "")}` : "";

const altText = (art) => {
  const prompt = art.prompt ? `: ${art.prompt}` : "";
  const text = `${art.title}${prompt}`;
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
};

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function App() {
  const [artworks, setArtworks] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE * 2);
  const [selectedArt, setSelectedArt] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [copyState, setCopyState] = useState("idle"); // idle | copied | failed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sentinelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const lastFocusedRef = useRef(null);

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

  const copyPrompt = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-buddha-dark flex items-center justify-center text-gray-400 font-mono text-sm tracking-widest">
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

  return (
    <div className="min-h-screen bg-buddha-dark text-gray-100 flex flex-col selection:bg-buddha-gold selection:text-black">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-buddha-dark/80 border-b border-[#1f232d]">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-medium tracking-wider text-xs uppercase text-gray-200">
              The Infinite Buddha
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAboutOpen(true)}
            className="text-[11px] font-mono tracking-widest uppercase text-gray-400 hover:text-buddha-gold transition-colors bg-transparent border-none cursor-pointer"
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
                Buddha of the Day
              </div>

              <img
                src={resolveUrl(heroPiece.imageUrl)}
                alt={altText(heroPiece)}
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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
                  alt={altText(art)}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
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
              className="absolute top-4 right-4 z-20 bg-[#1f232d] hover:bg-[#272b36] text-gray-300 p-2 rounded-full transition-colors"
            >
              <CloseIcon />
            </button>
            <div className="bg-black flex items-center justify-center aspect-square">
              <img
                src={resolveUrl(selectedArt.imageUrl)}
                alt={altText(selectedArt)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="text-xs font-mono text-buddha-gold tracking-widest uppercase">{selectedArt.date}</div>
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">Title</h4>
                  <p className="text-gray-100 text-lg font-serif">{selectedArt.title}</p>
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">Generation Prompt</h4>
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
              <button
                type="button"
                onClick={() => copyPrompt(selectedArt.prompt)}
                className="w-full py-3 px-4 bg-[#1f232d] hover:bg-[#272b36] text-gray-200 text-xs font-mono tracking-wider uppercase rounded-lg transition-colors flex items-center justify-center space-x-2 border border-[#272b36]"
              >
                <span>{copyLabel}</span>
              </button>
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
              className="absolute top-4 right-4 z-20 bg-[#1f232d] hover:bg-[#272b36] text-gray-300 p-2 rounded-full transition-colors"
            >
              <CloseIcon />
            </button>

            <div className="space-y-2">
              <h3 className="text-xl font-serif text-gray-100 tracking-wide">About Infinite Buddha</h3>
              <p className="text-xs font-mono text-buddha-gold tracking-widest uppercase">Autonomous Generative Art</p>
            </div>

            <p className="text-sm text-gray-300 font-light leading-relaxed">
              The Infinite Buddha is generative art project by JeffreyAiFudenna. With just a very human hope that if we can create anything with AI, that we choose to create good and propsperous things for everyone to enjoy.
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
        <footer className="w-full py-12 px-6 border-t border-[#1f232d] text-xs font-mono text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>© {new Date().getFullYear()} The Infinite Buddha. Autonomous Buddha Image Gen.</div>
          <div className="text-gray-400">Powered by JeffreyAiFudenna, Python, Gemini API, ClaudeCode and React</div>
        </div>
      </footer>
    </div>
  );
}