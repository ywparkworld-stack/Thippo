import Link from "next/link";
import { publicStorageUrl } from "@thippo/db";
import { formatYen } from "@thippo/ui";

export interface SpaceCardData {
  id: string;
  name: string;
  area: string;
  capacity: number;
  price_per_30min: number;
  min_slots: number;
  company_name: string;
  cover_path: string | null;
}

export function SpaceCard({ space, date }: { space: SpaceCardData; date?: string }) {
  return (
    <Link
      href={date ? `/spaces/${space.id}?date=${date}` : `/spaces/${space.id}`}
      className="block overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm hover:shadow"
    >
      {space.cover_path ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage の公開 URL
        <img
          src={publicStorageUrl("space-photos", space.cover_path)}
          alt=""
          className="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-zinc-100 text-sm text-zinc-400">
          写真なし
        </div>
      )}
      <div className="space-y-1 p-4">
        <p className="text-xs text-zinc-500">
          {space.area}・{space.company_name}
        </p>
        <h2 className="font-bold">{space.name}</h2>
        <p className="text-sm text-zinc-600">定員 {space.capacity}人</p>
        <p className="text-sm">
          <span className="text-lg font-bold">{formatYen(space.price_per_30min)}</span> / 30分
          {space.min_slots > 1 && (
            <span className="ml-2 text-xs text-zinc-500">{space.min_slots * 30}分から</span>
          )}
        </p>
      </div>
    </Link>
  );
}
