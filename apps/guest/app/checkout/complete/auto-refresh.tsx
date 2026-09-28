"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 支払いの確認が済むまで、3秒ごとに画面を更新する（最大2分） */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      if (++count > 40) return clearInterval(timer);
      router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
