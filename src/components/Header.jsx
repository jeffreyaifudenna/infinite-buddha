import React from 'react';

export default function Header({ onOpenAbout }) {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-buddha-dark/80 border-b border-gray-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Title Only */}
        <div>
          <h1 className="text-xl font-serif font-bold tracking-wider text-white">
            INFINITE BUDDHA
          </h1>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onOpenAbout}
            className="px-4 py-2 rounded-xl bg-buddha-card hover:bg-gray-800 text-gray-200 hover:text-buddha-gold border border-gray-800 text-xs font-medium transition-all shadow-sm"
          >
            About Project
          </button>
        </div>

      </div>
    </header>
  );
}