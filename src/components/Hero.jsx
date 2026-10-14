import React from 'react';

export default function Hero({ latestPiece, onOpenModal }) {
  if (!latestPiece) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full h-80 rounded-3xl bg-buddha-card border border-gray-800/80 flex flex-col items-center justify-center text-center p-6 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-buddha-gold/10 border border-buddha-gold/30 flex items-center justify-center text-buddha-gold text-xl mb-3">
            ☯
          </div>
          <h3 className="text-white font-serif font-bold text-lg mb-1">No Art Generated Yet</h3>
          <p className="text-xs font-mono text-buddha-muted max-w-sm">
            Run your Python generation script to create and publish your first Infinite Buddha piece.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div 
        onClick={() => onOpenModal && onOpenModal(latestPiece)}
        className="group relative w-full bg-buddha-card border border-gray-800/80 rounded-3xl overflow-hidden cursor-pointer shadow-2xl hover:border-buddha-gold/50 transition-all duration-300 p-4 sm:p-6"
      >
        <div className="relative w-full max-h-[80vh] overflow-hidden rounded-2xl bg-black/80 flex items-center justify-center">
          <img
            src={latestPiece.imageUrl}
            alt={latestPiece.title}
            className="w-full h-auto max-h-[75vh] object-contain group-hover:scale-[1.02] transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity pointer-events-none" />
          
          {/* Floating minimal title tag */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-white pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
              <span className="text-xs font-mono text-buddha-gold uppercase tracking-wider block">Latest Creation • {latestPiece.date}</span>
              <h2 className="text-lg sm:text-2xl font-serif font-bold text-white">{latestPiece.title}</h2>
            </div>
            <div className="hidden sm:flex items-center space-x-2 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs font-medium text-buddha-gold group-hover:bg-buddha-gold group-hover:text-buddha-dark transition-colors">
              <span>Inspect Artwork ↗</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}