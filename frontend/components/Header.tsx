export default function Header() {
  return (
    <header className="border-b border-line bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-ink"
        >
          <span className="gradient-text">✦ PDF AI</span>
        </a>
        <a
          href="#eval"
          className="rounded-full px-3 py-1.5 font-body text-sm font-medium text-muted transition-colors hover:bg-line/60 hover:text-ink"
        >
          품질 비교
        </a>
      </div>
    </header>
  );
}
