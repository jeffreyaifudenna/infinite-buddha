import React from 'react';

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl bg-buddha-card border border-gray-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-buddha-gold/10 border border-buddha-gold/30 flex items-center justify-center text-buddha-gold font-serif text-sm">
              ☯
            </div>
            <h3 className="text-lg font-serif font-bold text-white tracking-wider">
              About Infinite Buddha
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black text-gray-400 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-sm text-gray-300 font-sans leading-relaxed">
          <div className="space-y-3">
            <h4 className="text-white font-serif font-bold text-base">The Concept</h4>
            <p>
              Infinite Buddha is a decoupled generative art experiment that blends ancient meditative iconography with automated low-poly sacred geometry. Every piece is autonomously brought to life through a script-driven pipeline.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-white font-serif font-bold text-base">Architecture & Stack</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <li className="p-3 rounded-xl bg-black/30 border border-gray-800/80">
                <span className="block text-xs font-mono font-bold text-buddha-gold mb-1">Backend Generator</span>
                <span className="text-xs text-gray-400">Python script powered by the Gemini API & Imagen models.</span>
              </li>
              <li className="p-3 rounded-xl bg-black/30 border border-gray-800/80">
                <span className="block text-xs font-mono font-bold text-buddha-gold mb-1">Data Bridge</span>
                <span className="text-xs text-gray-400">JSON manifest feed mapping prompts, seeds, and assets.</span>
              </li>
              <li className="p-3 rounded-xl bg-black/30 border border-gray-800/80">
                <span className="block text-xs font-mono font-bold text-buddha-gold mb-1">Frontend UI</span>
                <span className="text-xs text-gray-400">React, Vite, and Tailwind CSS for a lightning-fast responsive interface.</span>
              </li>
              <li className="p-3 rounded-xl bg-black/30 border border-gray-800/80">
                <span className="block text-xs font-mono font-bold text-buddha-gold mb-1">Hosting</span>
                <span className="text-xs text-gray-400">Static deployment pipeline updated automatically via automation cron.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/40 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-buddha-gold hover:bg-buddha-goldLight text-buddha-dark font-semibold text-xs transition-colors"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
}