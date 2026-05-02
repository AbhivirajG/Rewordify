export function Footer() {
  return (
    <footer className="bg-neutral-950 border-t border-neutral-900 w-full mt-12">
      <div className="flex justify-between items-center w-full px-8 py-6 max-w-5xl mx-auto">
        <div className="font-['Space_Grotesk'] text-[10px] tracking-widest uppercase text-neutral-600">
          © 2024 REWORDIFY v1.0.4
        </div>
        <div className="flex gap-6">
          <a
            href="#"
            className="font-['Space_Grotesk'] text-[10px] tracking-widest uppercase text-neutral-600 hover:text-amber-500 transition-colors duration-150"
          >
            Documentation
          </a>
          <a
            href="#"
            className="font-['Space_Grotesk'] text-[10px] tracking-widest uppercase text-neutral-600 hover:text-amber-500 transition-colors duration-150"
          >
            Privacy
          </a>
          <a
            href="#"
            className="font-['Space_Grotesk'] text-[10px] tracking-widest uppercase text-neutral-600 hover:text-amber-500 transition-colors duration-150"
          >
            GitHub
          </a>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
          <span className="font-['Space_Grotesk'] text-[10px] tracking-widest uppercase text-neutral-600">
            Node: US-EAST-1
          </span>
        </div>
      </div>
    </footer>
  );
}
