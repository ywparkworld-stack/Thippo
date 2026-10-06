import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
const updated: Record<string, unknown>[] = [];
let existing: { id: string }[] = [];
const statusFilter = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@thippo/db/admin", () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({
      select: () => {
        const q = {
          eq: () => q,
          in: (_col: string, values: string[]) => {
            statusFilter(values);
            return q;
          },
          limit: async () => ({ data: existing }),
        };
        return q;
      },
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "n1" }, error: null }) }) };
      },
      update: (row: Record<string, unknown>) => {
        updated.push(row);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

const { sendTemplatedEmail } = await import("../src/send");

const input = {
  template: "contactReceived" as const,
  to: "a@example.com",
  userId: null,
  data: { name: "山田", body: "質問です" },
};

beforeEach(() => {
  inserted.length = 0;
  updated.length = 0;
  existing = [];
  statusFilter.mockReset();
});

describe("sendTemplatedEmail（手作業で送る。付録 D39）", () => {
  it("送らずに本文ごと記録し、送信待ちのまま残す", async () => {
    const r = await sendTemplatedEmail({ ...input, mailer: null, idempotencyKey: "k1" });
    expect(r).toEqual({ ok: true, notificationId: "n1" });
    expect(inserted[0]).toMatchObject({ to_email: "a@example.com", body: expect.any(String) });
    expect(String(inserted[0]!.body)).toContain("山田");
    expect(updated).toHaveLength(0);
    // 二重に作らないよう、送信待ちのメールも重複の確認に含める
    expect(statusFilter).toHaveBeenCalledWith(["sent", "queued"]);
  });

  it("同じキーで送信待ちがあれば作らない", async () => {
    existing = [{ id: "n0" }];
    const r = await sendTemplatedEmail({ ...input, mailer: null, idempotencyKey: "k1" });
    expect(r).toEqual({ ok: true, notificationId: "n0" });
    expect(inserted).toHaveLength(0);
  });

  it("Mailer があれば送って送信済みにする", async () => {
    const send = vi.fn(async () => ({ id: "m1" }));
    await sendTemplatedEmail({ ...input, mailer: { send } });
    expect(send).toHaveBeenCalledOnce();
    expect(updated[0]).toMatchObject({ status: "sent", provider_message_id: "m1" });
  });
});
