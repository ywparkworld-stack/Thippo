import { baseNextConfig } from "@thippo/next-config";

// 運営管理は検索エンジンに載せず、ほかのサイトに埋め込ませない（SPEC §3.2）
export default baseNextConfig([
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
]);
