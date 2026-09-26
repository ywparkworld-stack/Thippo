/**
 * 料率・単価・下限などの設定値。お金と時間に関わる数値はすべてここにまとめる。
 * DB 側で同じ数値が必要な場合も、ここを唯一の出典とする（SPEC §5）。
 *
 * 金額はすべて整数の円。率は浮動小数点を避けるため「分子 / 分母」の整数で持つ。
 */

export const SLOT_MINUTES = 30;

export const PRICING = {
  /** 消費税率（%）。運営手数料の税計算に使う。 */
  consumptionTaxPercent: 10,
  /** 運営手数料（1時間あたり・税抜）。通常時と「返金なし」のキャンセル時。 */
  platformFeePerHourExclTax: 200,
  /** 半額返金のキャンセル時に運営が受け取る手数料（1時間あたり・税抜）。 */
  halfCancelPlatformFeePerHourExclTax: 100,
  /** Stripe 決済手数料の見込み率 3.6% = 36 / 1000。予約1件ごとに切り上げる。 */
  stripeFeeRate: { numerator: 36, denominator: 1000 },
  /**
   * 1件の予約の最大枠数。空き枠は1日の営業時間内で選ぶため最大 24 時間 = 48 枠。
   * 下限料金の計算で「どの枠数でも手取りがマイナスにならない」ことを確かめる範囲にも使う。
   */
  maxSlotsPerBooking: 48,
  /** 貸出主が設定できる 30 分あたり料金の上限（入力ミス防止）。 */
  maxPricePer30min: 1_000_000,
} as const;

export const BOOKING = {
  /** 予約を受け付ける範囲。利用終了時刻が「現在時刻 + この日数」以内であること（SPEC §7-8）。 */
  maxAdvanceDays: 30,
  /** pending の注文を expired にするまでの時間（SPEC §7-4）。 */
  pendingOrderTtlMinutes: 15,
} as const;

export const CANCELLATION = {
  /** 利用開始の何分前までなら全額返金か（SPEC §8）。 */
  fullRefundBeforeMinutes: 120,
  /** キャンセル回数を数える移動窓の長さ（時間）。 */
  countWindowHours: 24,
  /** 窓内の利用者自身のキャンセルがこの回数以上あれば、次のキャンセルは返金なし。 */
  maxCancelsBeforeNoRefund: 5,
} as const;

export const IDENTITY = {
  /**
   * 退会したユーザーの本人確認書類を保存する日数。
   * TODO(要確認): 法令上の保存期間を運営が決める（SPEC §3.3, §16）。決まるまで削除処理は動かさない。
   */
  documentRetentionDaysAfterWithdrawal: null as number | null,
} as const;

/** 画面の表示と入力に使うタイムゾーン（SPEC §0）。 */
export const TIME_ZONE = "Asia/Tokyo";
/** Asia/Tokyo は 1951 年以降夏時間がないため、固定オフセットで扱う。 */
export const TOKYO_UTC_OFFSET_MINUTES = 9 * 60;

export const AUTH = {
  /** パスワードの最小文字数（Supabase Auth の minimum_password_length と揃える） */
  minPasswordLength: 10,
  /** bcrypt が扱える上限（UTF-8 で 72 バイト） */
  maxPasswordBytes: 72,
} as const;

/**
 * レート制限（SPEC §3.3）。Postgres の固定窓カウンターで数える（付録 D5）。
 * 同じ操作を IP アドレス単位とメールアドレス（または利用者）単位の両方で数える。
 */
export const RATE_LIMITS = {
  login: {
    perIp: { limit: 20, windowSeconds: 600 },
    perAccount: { limit: 10, windowSeconds: 600 },
  },
  signup: {
    perIp: { limit: 5, windowSeconds: 3600 },
    perAccount: { limit: 3, windowSeconds: 3600 },
  },
  passwordReset: {
    perIp: { limit: 5, windowSeconds: 3600 },
    perAccount: { limit: 3, windowSeconds: 3600 },
  },
  mfaVerify: {
    perIp: { limit: 20, windowSeconds: 600 },
    perAccount: { limit: 10, windowSeconds: 600 },
  },
  cancel: {
    perIp: { limit: 30, windowSeconds: 600 },
    perAccount: { limit: 10, windowSeconds: 600 },
  },
  hostApplication: {
    perIp: { limit: 5, windowSeconds: 3600 },
    perAccount: { limit: 2, windowSeconds: 86400 },
  },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/** Stripe Connect（SPEC §2, §7。付録 D14・D15） */
export const STRIPE_CONNECT = {
  country: "JP",
  currency: "jpy",
  /** 貸出主への入金は月次。毎月この日に入金する（D15） */
  payoutMonthlyAnchor: 23,
} as const;

/** スペースの写真（付録 D16） */
export const SPACE_PHOTO = {
  maxPerSpace: 5,
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;
