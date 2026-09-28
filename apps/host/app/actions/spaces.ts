"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  SPACE_PHOTO,
  availabilityRulesSchema,
  closureSchema,
  detectImageType,
  fieldErrors,
  spaceSchema,
  toTokyoDate,
} from "@thippo/core";
import type { FormState } from "@thippo/auth";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { requireHost } from "../lib/host";

const PHOTO_BUCKET = "space-photos";

const DB_MESSAGES: Record<string, string> = {
  spaces_price_range: "料金が下限を下回っているか、上限を超えています。",
  spaces_host_ready: "Stripe での入金先の登録が完了していないため、公開できません。",
  space_has_upcoming_bookings: "これからの予約があるため削除できません。",
  too_many_photos: `写真は${SPACE_PHOTO.maxPerSpace}枚までです。`,
  overlapping_rules: "同じ曜日の営業時間が重なっています。",
  only_admins_can_suspend: "運営により公開停止されています。運営にお問い合わせください。",
  "only admins can suspend": "運営により公開停止されています。運営にお問い合わせください。",
};
function dbMessage(message?: string): string {
  return (
    Object.entries(DB_MESSAGES).find(([k]) => message?.includes(k))?.[1] ??
    "保存に失敗しました。時間をおいてもう一度お試しください。"
  );
}

const spaceIdSchema = z.uuid();

function spaceFormValues(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    address: formData.get("address") ?? "",
    area: formData.get("area") ?? "",
    capacity: formData.get("capacity") ?? "",
    amenities: formData.get("amenities") ?? "",
    pricePer30min: formData.get("pricePer30min") ?? "",
    minSlots: formData.get("minSlots") ?? "",
  };
}

export async function createSpaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, host } = await requireHost("/spaces/new");
  const parsed = spaceSchema.safeParse(spaceFormValues(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const s = parsed.data;
  const { data, error } = await supabase
    .from("spaces")
    .insert({
      host_id: host.id,
      name: s.name,
      description: s.description,
      address: s.address,
      area: s.area,
      capacity: s.capacity,
      amenities: s.amenities,
      price_per_30min: s.pricePer30min,
      min_slots: s.minSlots,
    })
    .select("id")
    .single();
  if (error || !data) return { error: dbMessage(error?.message) };
  redirect(`/spaces/${data.id}?created=1`);
}

/** 料金を変更しても、確定済みの予約の金額は変わらない（予約に料金を保存しているため。SPEC §9） */
export async function updateSpaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireHost();
  const spaceId = spaceIdSchema.safeParse(formData.get("spaceId"));
  if (!spaceId.success) return { error: "スペースが見つかりません。" };
  const parsed = spaceSchema.safeParse(spaceFormValues(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const s = parsed.data;
  const { data, error } = await supabase
    .from("spaces")
    .update({
      name: s.name,
      description: s.description,
      address: s.address,
      area: s.area,
      capacity: s.capacity,
      amenities: s.amenities,
      price_per_30min: s.pricePer30min,
      min_slots: s.minSlots,
    })
    .eq("id", spaceId.data)
    .select("id");
  if (error) return { error: dbMessage(error.message) };
  if (!data || data.length === 0) return { error: "スペースが見つかりません。" };
  revalidatePath(`/spaces/${spaceId.data}`);
  return { message: "保存しました。" };
}

export async function setSpaceStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireHost();
  const parsed = z
    .object({ spaceId: z.uuid(), status: z.enum(["published", "draft"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "操作が正しくありません。" };
  const { error } = await supabase
    .from("spaces")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.spaceId);
  if (error) return { error: dbMessage(error.message) };
  revalidatePath(`/spaces/${parsed.data.spaceId}`);
  revalidatePath("/spaces");
  return { message: parsed.data.status === "published" ? "公開しました。" : "非公開にしました。" };
}

export async function deleteSpaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireHost();
  const spaceId = spaceIdSchema.safeParse(formData.get("spaceId"));
  if (!spaceId.success) return { error: "スペースが見つかりません。" };
  const { error } = await supabase
    .from("spaces")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", spaceId.data);
  if (error) return { error: dbMessage(error.message) };
  redirect("/spaces?deleted=1");
}

// ---------------------------------------------------------------------------
// 写真
// ---------------------------------------------------------------------------

/** ブラウザからアップロードした写真を確かめて登録する。画像でなければストレージから消す */
export async function addSpacePhotoAction(
  spaceId: string,
  path: string,
): Promise<{ error?: string }> {
  const { supabase } = await requireHost();
  if (
    !spaceIdSchema.safeParse(spaceId).success ||
    !path.startsWith(`${spaceId}/`) ||
    path.length > 300
  ) {
    return { error: "アップロードに失敗しました。" };
  }
  // 自社のスペースかを RLS で確かめる
  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) return { error: "スペースが見つかりません。" };

  const service = createSupabaseServiceClient();
  const { data: file } = await service.storage.from(PHOTO_BUCKET).download(path);
  const ok =
    !!file &&
    file.size <= SPACE_PHOTO.maxBytes &&
    detectImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer())) !== null;
  if (!ok) {
    await service.storage.from(PHOTO_BUCKET).remove([path]);
    return { error: "JPEG・PNG・WebP の画像を10MB以内でアップロードしてください。" };
  }

  const { count } = await supabase
    .from("space_photos")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId);
  const { error } = await supabase
    .from("space_photos")
    .insert({ space_id: spaceId, storage_path: path, sort_order: count ?? 0 });
  if (error) {
    await service.storage.from(PHOTO_BUCKET).remove([path]);
    return { error: dbMessage(error.message) };
  }
  revalidatePath(`/spaces/${spaceId}/photos`);
  return {};
}

export async function deleteSpacePhotoAction(formData: FormData): Promise<void> {
  const { supabase } = await requireHost();
  const photoId = z.uuid().safeParse(formData.get("photoId"));
  if (!photoId.success) return;
  const { data: photo } = await supabase
    .from("space_photos")
    .delete()
    .eq("id", photoId.data)
    .select("space_id, storage_path")
    .maybeSingle();
  if (!photo) return;
  await createSupabaseServiceClient().storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  revalidatePath(`/spaces/${photo.space_id}/photos`);
}

/** 写真を先頭（一覧に表示する写真）にする */
export async function makeCoverPhotoAction(formData: FormData): Promise<void> {
  const { supabase } = await requireHost();
  const photoId = z.uuid().safeParse(formData.get("photoId"));
  if (!photoId.success) return;
  const { data: photo } = await supabase
    .from("space_photos")
    .select("id, space_id")
    .eq("id", photoId.data)
    .maybeSingle();
  if (!photo) return;
  const { data: photos } = await supabase
    .from("space_photos")
    .select("id")
    .eq("space_id", photo.space_id)
    .order("sort_order")
    .order("created_at");
  const ordered = [photo.id, ...(photos ?? []).map((p) => p.id).filter((id) => id !== photo.id)];
  for (const [i, id] of ordered.entries()) {
    await supabase.from("space_photos").update({ sort_order: i }).eq("id", id);
  }
  revalidatePath(`/spaces/${photo.space_id}/photos`);
}

// ---------------------------------------------------------------------------
// 営業時間・休業日
// ---------------------------------------------------------------------------

export async function saveAvailabilityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireHost();
  const spaceId = spaceIdSchema.safeParse(formData.get("spaceId"));
  if (!spaceId.success) return { error: "スペースが見つかりません。" };

  const rules: { weekday: number; openTime: string; closeTime: string }[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let i = 0; i < 2; i++) {
      const openTime = String(formData.get(`open_${weekday}_${i}`) ?? "");
      const closeTime = String(formData.get(`close_${weekday}_${i}`) ?? "");
      if (!openTime && !closeTime) continue;
      rules.push({ weekday, openTime, closeTime });
    }
  }
  const parsed = availabilityRulesSchema.safeParse(rules);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "営業時間が正しくありません。" };

  const { error } = await supabase.rpc("replace_availability_rules", {
    p_space_id: spaceId.data,
    p_rules: parsed.data.map((r) => ({
      weekday: r.weekday,
      open_time: r.openTime,
      close_time: r.closeTime,
    })),
  });
  if (error) return { error: dbMessage(error.message) };
  revalidatePath(`/spaces/${spaceId.data}/availability`);
  return { message: "営業時間を保存しました。" };
}

export async function addClosureAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireHost();
  const spaceId = spaceIdSchema.safeParse(formData.get("spaceId"));
  const parsed = closureSchema.safeParse({ date: formData.get("date") });
  if (!spaceId.success || !parsed.success) return { error: "日付を選んでください。" };
  if (parsed.data.date < toTokyoDate(new Date()))
    return { error: "今日以降の日付を選んでください。" };
  const { error } = await supabase
    .from("closures")
    .insert({ space_id: spaceId.data, date: parsed.data.date });
  if (error && !error.message.includes("duplicate")) return { error: dbMessage(error.message) };
  revalidatePath(`/spaces/${spaceId.data}/availability`);
  return { message: "休業日を追加しました。" };
}

export async function deleteClosureAction(formData: FormData): Promise<void> {
  const { supabase } = await requireHost();
  const spaceId = spaceIdSchema.safeParse(formData.get("spaceId"));
  const parsed = closureSchema.safeParse({ date: formData.get("date") });
  if (!spaceId.success || !parsed.success) return;
  await supabase
    .from("closures")
    .delete()
    .eq("space_id", spaceId.data)
    .eq("date", parsed.data.date);
  revalidatePath(`/spaces/${spaceId.data}/availability`);
}
