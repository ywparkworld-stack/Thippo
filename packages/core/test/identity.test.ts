import { describe, expect, it } from "vitest";
import {
  acceptsBackSide,
  detectFileType,
  identityErrorMessage,
  identityReviewSchema,
} from "../src";

const bytes = (...v: number[]) => new Uint8Array(v);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("detectFileType", () => {
  it("JPEG・PNG・PDF・HEIC を中身で判定する", () => {
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png",
    );
    expect(detectFileType(ascii("%PDF-1.7"))).toBe("application/pdf");
    expect(detectFileType(new Uint8Array([0, 0, 0, 24, ...ascii("ftypheic")]))).toBe("image/heic");
  });

  it("それ以外（拡張子だけ変えたファイルなど）は受け付けない", () => {
    expect(detectFileType(ascii("<html>"))).toBeNull();
    expect(detectFileType(ascii("GIF89a"))).toBeNull();
    expect(detectFileType(new Uint8Array([0, 0, 0, 24, ...ascii("ftypmp42")]))).toBeNull();
    expect(detectFileType(new Uint8Array())).toBeNull();
  });
});

describe("identity", () => {
  it("マイナンバーカードは裏面を受け付けない", () => {
    expect(acceptsBackSide("my_number_card")).toBe(false);
    expect(acceptsBackSide("drivers_license")).toBe(true);
  });

  it("却下には理由が必要", () => {
    const id = "6f1c2b3a-1d2e-4f5a-8b9c-0d1e2f3a4b5c";
    expect(identityReviewSchema.safeParse({ decision: "approve", documentId: id }).success).toBe(
      true,
    );
    expect(
      identityReviewSchema.safeParse({ decision: "reject", documentId: id, rejectReason: " " })
        .success,
    ).toBe(false);
    expect(
      identityReviewSchema.safeParse({
        decision: "reject",
        documentId: id,
        rejectReason: "読めません",
        requestBackSide: "on",
      }).success,
    ).toBe(true);
  });

  it("DB のエラーコードを文言にする", () => {
    expect(identityErrorMessage("back_side_required")).toMatch(/裏面/);
    expect(identityErrorMessage("unknown")).toMatch(/処理に失敗しました/);
  });
});
