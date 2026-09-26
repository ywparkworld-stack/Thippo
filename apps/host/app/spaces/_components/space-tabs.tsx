import Link from "next/link";

export function SpaceTabs({
  spaceId,
  current,
}: {
  spaceId: string;
  current: "info" | "photos" | "availability";
}) {
  const tabs = [
    { key: "info", href: `/spaces/${spaceId}`, label: "基本情報・料金" },
    { key: "photos", href: `/spaces/${spaceId}/photos`, label: "写真" },
    { key: "availability", href: `/spaces/${spaceId}/availability`, label: "営業時間・休業日" },
  ] as const;
  return (
    <nav className="flex gap-2 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={
            t.key === current
              ? "rounded-md bg-brand-600 px-3 py-1 text-white"
              : "rounded-md border px-3 py-1"
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
