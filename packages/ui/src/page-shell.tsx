import type { ReactNode } from "react";

/** 3アプリ共通のページの枠。サイト名と配色だけをアプリごとに変える。 */
export function PageShell({
  siteName,
  nav,
  children,
}: {
  siteName: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="text-lg font-bold text-brand-700">{siteName}</span>
          {nav}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-zinc-200 bg-white py-6 text-center text-xs text-zinc-500">
        © thippo
      </footer>
    </div>
  );
}
