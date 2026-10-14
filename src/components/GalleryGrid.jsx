import React from 'react';

export default function GalleryGrid({ pieces, onOpenModal }) {
  if (!pieces || pieces.length === 0) {
    return null; // Hide archive grid entirely if there are no older pieces
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-mono uppercase tracking-widest text-buddha-muted">
          Archive Feed
        </h3>
        <span className="text-xs font-mono text-buddha-gold bg-buddha-gold/10 px-3 py-1 rounded-full border border-buddha-gold/20">
          {pieces.length} {pieces.length === 1 ? 'Piece' : 'Pieces'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {pieces.map((piece) => (
          <div
            key={piece.id}
            onClick={() => onOpenModal(piece)}
            className="group bg-buddha-card border border-gray-800/80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:border-buddha-gold/50 transition-all duration-300 flex flex-col"
          >
            <div className="relative aspect-[16/9] bg-black/50 overflow-hidden flex items-center justify-center">
              <img
                src={piece.imageUrl}
                alt={piece.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
            </div>
            <div className="p-4 flex items-center justify-between bg-buddha-card">
              <div>
                <span className="text-[10px] font-mono text-buddha-gold uppercase tracking-wider block">{piece.date}</span>
                <h4 className="text-white font-serif font-bold text-sm">{piece.title}</h4>
              </div>
              <span className="text-xs text-buddha-muted group-hover:text-buddha-gold transition-colors">↗</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}