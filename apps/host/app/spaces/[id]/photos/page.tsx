import { notFound } from "next/navigation";
import Link from "next/link";
import { SPACE_PHOTO } from "@thippo/core";
import { publicStorageUrl } from "@thippo/db";
import { Card } from "@thippo/ui";
import { deleteSpacePhotoAction, makeCoverPhotoAction } from "../../../actions/spaces";
import { requireHost } from "../../../lib/host";
import { SpaceTabs } from "../../_components/space-tabs";
import { PhotoUploader } from "./uploader";

export default async function PhotosPage(props: PageProps<"/spaces/[id]/photos">) {
  const { id } = await props.params;
  const { supabase, host } = await requireHost(`/spaces/${id}/photos`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: space } = await supabase
    .from("spaces")
    .select("id, name")
    .eq("id", id)
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!space) notFound();
  const { data: photos } = await supabase
    .from("space_photos")
    .select("id, storage_path")
    .eq("space_id", id)
    .order("sort_order")
    .order("created_at");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/spaces" className="text-sm text-brand-700 underline">
        スペース一覧
      </Link>
      <h1 className="text-2xl font-bold">{space.name}</h1>
      <SpaceTabs spaceId={id} current="photos" />
      <Card className="space-y-4">
        <p className="text-sm text-zinc-600">
          写真は{SPACE_PHOTO.maxPerSpace}
          枚まで（JPEG・PNG・WebP、1枚10MBまで）。先頭の写真が一覧に表示されます。
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {(photos ?? []).map((p, i) => (
            <figure key={p.id} className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage の公開 URL */}
              <img
                src={publicStorageUrl("space-photos", p.storage_path)}
                alt={`写真${i + 1}`}
                className="aspect-[4/3] w-full rounded object-cover"
              />
              <div className="flex gap-2 text-xs">
                {i > 0 && (
                  <form action={makeCoverPhotoAction}>
                    <input type="hidden" name="photoId" value={p.id} />
                    <button type="submit" className="underline">
                      先頭にする
                    </button>
                  </form>
                )}
                <form action={deleteSpacePhotoAction}>
                  <input type="hidden" name="photoId" value={p.id} />
                  <button type="submit" className="text-red-600 underline">
                    削除
                  </button>
                </form>
              </div>
            </figure>
          ))}
        </div>
        {(photos ?? []).length < SPACE_PHOTO.maxPerSpace && <PhotoUploader spaceId={id} />}
      </Card>
    </div>
  );
}
