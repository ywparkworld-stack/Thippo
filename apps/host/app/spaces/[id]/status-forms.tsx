"use client";

import { useActionState } from "react";
import { initialFormState } from "@thippo/auth";
import { Notice, SubmitButton } from "@thippo/ui";
import { deleteSpaceAction, setSpaceStatusAction } from "../../actions/spaces";

export function StatusForm({
  spaceId,
  status,
}: {
  spaceId: string;
  status: "draft" | "published" | "suspended";
}) {
  const [state, action] = useActionState(setSpaceStatusAction, initialFormState);
  const next = status === "published" ? "draft" : "published";
  return (
    <form action={action} className="space-y-2">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <p className="text-sm">現在：{status === "published" ? "公開中" : "非公開"}</p>
      <input type="hidden" name="spaceId" value={spaceId} />
      <input type="hidden" name="status" value={next} />
      <SubmitButton variant={next === "draft" ? "secondary" : "primary"}>
        {next === "published" ? "公開する" : "非公開にする"}
      </SubmitButton>
    </form>
  );
}

export function DeleteSpaceForm({ spaceId }: { spaceId: string }) {
  const [state, action] = useActionState(deleteSpaceAction, initialFormState);
  return (
    <form
      action={action}
      className="space-y-2"
      onSubmit={(e) => {
        if (!confirm("このスペースを削除しますか？")) e.preventDefault();
      }}
    >
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <p className="text-xs text-zinc-500">これからの予約があるスペースは削除できません。</p>
      <input type="hidden" name="spaceId" value={spaceId} />
      <SubmitButton variant="danger">削除する</SubmitButton>
    </form>
  );
}
