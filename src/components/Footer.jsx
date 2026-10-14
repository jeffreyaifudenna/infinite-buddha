import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-800/80 bg-buddha-dark py-10 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-buddha-gold/10 border border-buddha-gold/20 flex items-center justify-center text-buddha-gold text-xs font-serif">
            ☯
          </div>
          <div>
            <p className="text-sm font-serif font-bold text-white tracking-wider">
              INFINITE BUDDHA
            </p>
            <p className="text-xs text-buddha-muted">
              Automated generative art feed powered by JeffreyAIFudenna.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-xs text-buddha-muted font-sans">
          <span>© {new Date().getFullYear()} Infinite Buddha</span>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-buddha-gold transition-colors"
          >
            GitHub Repository
          </a>
          <a 
            href="https://instagram.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-buddha-gold transition-colors"
          >
            Instagram Feed
          </a>
        </div>

      </div>
    </footer>
  );
}