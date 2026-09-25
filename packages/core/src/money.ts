/** 整数（円）の計算だけを行うための補助関数。浮動小数点の割り算は使わない。 */

export function assertYen(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer (yen), got ${value}`);
  }
}

export function assertNonNegativeYen(value: number, label = "amount"): void {
  assertYen(value, label);
  if (value < 0) throw new RangeError(`${label} must be >= 0, got ${value}`);
}

/** floor(a / b)。a >= 0, b > 0 の整数。 */
export function floorDiv(a: number, b: number): number {
  assertNonNegativeYen(a, "dividend");
  if (!Number.isSafeInteger(b) || b <= 0) throw new RangeError(`divisor must be > 0, got ${b}`);
  return (a - (a % b)) / b;
}

/** ceil(a / b)。a >= 0, b > 0 の整数。 */
export function ceilDiv(a: number, b: number): number {
  const q = floorDiv(a, b);
  return a % b === 0 ? q : q + 1;
}

/** 整数の掛け算。結果が安全な整数の範囲を超えたら例外にする。 */
export function mulYen(a: number, b: number): number {
  const r = a * b;
  assertYen(r, "product");
  return r;
}

export function sumYen(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertYen(v);
    total += v;
  }
  assertYen(total, "sum");
  return total;
}
