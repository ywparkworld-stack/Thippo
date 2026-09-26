"use client";

import { Button } from "@thippo/ui";

export function PrintButton() {
  return (
    <div className="print:hidden">
      <Button variant="secondary" onClick={() => window.print()}>
        印刷する・PDFで保存する
      </Button>
    </div>
  );
}
