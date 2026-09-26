import { describe, expect, it } from "vitest";
import { calcBookingFees, calcRefund } from "@thippo/core";
import { anon, as, asSuperuser, expectError, uid, user } from "./helpers/db";
import { createHostWithSpace, createUser } from "./helpers/fixtures";

const admin = async () => user(await createUser("admin"), "aal2");

describe("運営の操作（理由必須・操作ログ・aal2 の admin だけ）", () => {
  it("利用者の停止と再開。admin のアカウントは停止できない", async () => {
    const a = await admin();
    const guest = await createUser();
    const otherAdmin = await createUser("admin");
    await as(a, async (db) => {
      expect(
        await expectError(db, "select public.admin_set_profile_status($1, 'suspended', ' ')", [
          guest,
        ]),
      ).toMatch(/reason_required/);
      await db.query("select public.admin_set_profile_status($1, 'suspended', '不正利用の疑い')", [
        guest,
      ]);
      const p = await db.query("select status from public.profiles where id = $1", [guest]);
      expect(p.rows[0].status).toBe("suspended");
      const log = await db.query(
        "select action, payload->>'reason' as reason from public.audit_logs where target_id = $1",
        [guest],
      );
      expect(log.rows).toEqual([{ action: "admin.user_suspend", reason: "不正利用の疑い" }]);
      expect(
        await expectError(db, "select public.admin_set_profile_status($1, 'suspended', 'x')", [
          otherAdmin,
        ]),
      ).toMatch(/cannot_change_admin/);
    });
  });

  it("貸出主を停止すると公開中のスペースはすべて非公開になり、確定済みの予約は残る（D28）", async () => {
    const a = await admin();
    const h = await createHostWithSpace();
    await as(a, async (db) => {
      const r = await db.query(
        "select public.admin_set_host_status($1, 'suspended', '規約違反') as n",
        [h.hostId],
      );
      expect(r.rows[0].n).toBe(1);
      const s = await db.query("select status from public.spaces where id = $1", [h.spaceId]);
      expect(s.rows[0].status).toBe("draft");
    });
    // 停止中の貸出主はスペースを公開できない
    // （上の操作はロールバックされるため、停止した状態を作り直す）
    await asSuperuser(async (db) => {
      await db.query("update public.hosts set status = 'suspended' where id = $1", [h.hostId]);
      await db.query("update public.spaces set status = 'draft' where id = $1", [h.spaceId]);
    });
    await as(user(h.memberId), async (db) => {
      await expectError(db, "update public.spaces set status = 'published' where id = $1", [
        h.spaceId,
      ]);
    });
  });

  it("スペースの公開停止と解除", async () => {
    const a = await admin();
    const h = await createHostWithSpace();
    await as(a, async (db) => {
      await db.query("select public.admin_set_space_suspended($1, true, '写真が不適切')", [
        h.spaceId,
      ]);
      expect(
        (await db.query("select status from public.spaces where id = $1", [h.spaceId])).rows[0]
          .status,
      ).toBe("suspended");
      await db.query("select public.admin_set_space_suspended($1, false, '修正を確認')", [
        h.spaceId,
      ]);
      expect(
        (await db.query("select status from public.spaces where id = $1", [h.spaceId])).rows[0]
          .status,
      ).toBe("draft");
    });
  });

  it("aal1 の admin・利用者・貸出主は運営の操作も集計もできない", async () => {
    const adminId = await createUser("admin");
    const h = await createHostWithSpace();
    const guest = await createUser();
    for (const actor of [user(adminId, "aal1"), user(guest), user(h.memberId, "aal2"), anon]) {
      await as(actor, async (db) => {
        await expectError(db, "select public.admin_set_profile_status($1, 'suspended', 'x')", [
          guest,
        ]);
        await expectError(db, "select public.admin_set_host_status($1, 'suspended', 'x')", [
          h.hostId,
        ]);
        await expectError(db, "select public.admin_set_space_suspended($1, true, 'x')", [
          h.spaceId,
        ]);
        await expectError(db, "select * from public.admin_month_summary('2026-09-01')");
        await expectError(db, "select * from public.admin_cancel_monitor()");
        await expectError(db, "select public.admin_record_action('admin.x', null, null)");
      });
    }
  });
});

describe("admin_month_summary（D27）", () => {
  it("実質収入 = 運営手数料（税抜）− 全額返金の決済手数料 −（実額 − 見込み額）", async () => {
    const a = await admin();
    const h = await createHostWithSpace();
    const month = "2031-03-01"; // ほかのテストのデータと重ならない月
    const make = async (paidAt: string, slots: number, day: number) => {
      const guestId = await createUser();
      const f = calcBookingFees({ pricePer30min: 1000, slots });
      const orderId = uid();
      const bookingId = uid();
      await asSuperuser(async (db) => {
        await db.query(
          `insert into public.orders (id, guest_id, host_id, total, application_fee_amount, status, paid_at, expires_at, stripe_payment_intent_id, stripe_fee_actual)
           values ($1, $2, $3, $4, $5, 'paid', $6, now(), $7, $8)`,
          [
            orderId,
            guestId,
            h.hostId,
            f.subtotal,
            f.applicationFee,
            paidAt,
            `pi_${orderId}`,
            f.stripeFeeEstimated + 3,
          ],
        );
        await db.query(
          `insert into public.bookings (id, order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total, status)
           values ($1, $2, $3, $4, $5, tstzrange($6::timestamptz, $6::timestamptz + $7 * interval '30 minutes', '[)'), $7, 1000, $8, 'confirmed')`,
          [
            bookingId,
            orderId,
            h.spaceId,
            guestId,
            h.hostId,
            `2031-04-${String(day).padStart(2, "0")}T10:00+09:00`,
            slots,
            f.subtotal,
          ],
        );
        await db.query(`insert into public.booking_fees values ($1, $2, $3, $4, $5, $6)`, [
          bookingId,
          f.hours,
          f.platformFeeExclTax,
          f.platformFeeTax,
          f.stripeFeeEstimated,
          f.applicationFee,
        ]);
      });
      return { bookingId, f };
    };
    const kept = await make("2031-03-05T12:00+09:00", 2, 1);
    const refunded = await make("2031-03-06T12:00+09:00", 4, 2);
    const r = calcRefund(refunded.f, "full");
    await asSuperuser(async (db) => {
      await db.query(
        "update public.bookings set status = 'cancelled', cancelled_by = 'guest', cancelled_at = '2031-03-07T10:00+09:00', cancel_policy = 'full' where id = $1",
        [refunded.bookingId],
      );
      await db.query(
        `insert into public.refunds (booking_id, policy, refund_amount, transfer_reversal_amount, platform_fee_excl_tax, platform_fee_tax, created_at)
         values ($1, 'full', $2, $3, 0, 0, '2031-03-07T10:00+09:00')`,
        [refunded.bookingId, r.refundAmount, r.transferReversalAmount],
      );
    });
    await as(a, async (db) => {
      const { rows } = await db.query("select * from public.admin_month_summary($1)", [month]);
      expect(rows[0]).toEqual({
        booking_count: 2,
        gross: kept.f.subtotal,
        platform_fee_excl_tax: kept.f.platformFeeExclTax,
        platform_fee_tax: kept.f.platformFeeTax,
        full_refund_stripe_fee: refunded.f.stripeFeeEstimated,
        stripe_fee_estimated: kept.f.stripeFeeEstimated + refunded.f.stripeFeeEstimated,
        stripe_fee_actual: kept.f.stripeFeeEstimated + refunded.f.stripeFeeEstimated + 6,
        stripe_fee_difference: 6,
        net_income: kept.f.platformFeeExclTax - refunded.f.stripeFeeEstimated - 6,
      });
      const hosts = await db.query(
        "select host_id, net, stripe_fee_difference from public.admin_host_month_summaries($1)",
        [month],
      );
      expect(hosts.rows).toEqual([
        { host_id: h.hostId, net: kept.f.hostPayout, stripe_fee_difference: 6 },
      ]);
    });
  });
});

describe("admin_cancel_monitor", () => {
  it("キャンセルが多い利用者を出す", async () => {
    const a = await admin();
    const h = await createHostWithSpace();
    const guest = await createUser();
    await asSuperuser(async (db) => {
      for (let i = 0; i < 3; i++) {
        const orderId = uid();
        const bookingId = uid();
        await db.query(
          `insert into public.orders (id, guest_id, host_id, total, application_fee_amount, status, paid_at, expires_at)
           values ($1, $2, $3, 2000, 292, 'paid', now(), now())`,
          [orderId, guest, h.hostId],
        );
        await db.query(
          `insert into public.bookings (id, order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total, status, cancelled_by, cancelled_at, cancel_policy)
           values ($1, $2, $3, $4, $5, tstzrange('2032-01-0${i + 1} 10:00+09', '2032-01-0${i + 1} 11:00+09', '[)'), 2, 1000, 2000, 'cancelled', 'guest', now(), 'full')`,
          [bookingId, orderId, h.spaceId, guest, h.hostId],
        );
        await db.query("insert into public.cancel_events (user_id, booking_id) values ($1, $2)", [
          guest,
          bookingId,
        ]);
      }
    });
    await as(a, async (db) => {
      const { rows } = await db.query(
        "select user_id, cancels_24h, cancels_30d from public.admin_cancel_monitor(3)",
      );
      expect(rows.find((r) => r.user_id === guest)).toEqual({
        user_id: guest,
        cancels_24h: 3,
        cancels_30d: 3,
      });
    });
  });
});
