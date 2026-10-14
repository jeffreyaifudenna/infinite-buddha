import React from 'react';

export default function ArtModal({ piece, onClose }) {
  if (!piece) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-5xl bg-buddha-card border border-gray-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row max-h-[90vh]">
        
        {/* Left: Full Image View */}
        <div className="lg:w-3/5 bg-black/60 p-4 sm:p-6 flex items-center justify-center relative overflow-hidden">
          <img
            src={piece.imageUrl}
            alt={piece.title}
            className="w-full h-auto max-h-[75vh] object-contain rounded-xl shadow-lg"
          />
        </div>

        {/* Right: Details Panel */}
        <div className="lg:w-2/5 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto space-y-6">
          
          {/* Top Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-buddha-gold uppercase tracking-widest bg-buddha-gold/10 px-3 py-1 rounded-full border border-buddha-gold/20">
                {piece.date}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black text-gray-400 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide mb-2">
                {piece.title}
              </h3>
              <p className="text-xs font-mono text-buddha-muted">
                Seed: <span className="text-gray-200">{piece.seed}</span>
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-800/80">
              <h4 className="text-xs font-mono uppercase tracking-wider text-buddha-gold">Prompt Mechanics</h4>
              <p className="text-sm text-gray-300 font-sans leading-relaxed bg-black/30 p-3.5 rounded-2xl border border-gray-800/80">
                "{piece.prompt}"
              </p>
            </div>
          </div>

          {/* Bottom Action */}
          <div className="pt-4 border-t border-gray-800/80 flex justify-end">
            <button
              onClick={onClose}
              className="w-full px-5 py-3 rounded-xl bg-buddha-gold hover:bg-buddha-goldLight text-buddha-dark font-semibold text-xs transition-colors shadow-lg tracking-wider uppercase font-mono"
            >
              Close Details
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}