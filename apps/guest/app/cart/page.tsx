import { createClient, loadSession } from "@thippo/auth/server";
import { removeCartItemAction } from "../actions/cart";
import { evaluateCartItems, loadServerCart } from "../lib/cart";
import { CartView } from "./cart-view";
import { LocalCart } from "./local-cart";

export const metadata = { title: "予約カゴ｜thippo" };

export default async function CartPage() {
  const supabase = await createClient();
  const session = await loadSession(supabase);
  const loggedInGuest = session?.role === "guest";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">予約カゴ</h1>
      {loggedInGuest ? (
        <CartView
          items={await evaluateCartItems(
            supabase,
            (await loadServerCart(supabase, session.userId)).entries,
          )}
          checkoutHref="/checkout"
          removeButton={(e) =>
            e.id && (
              <form action={removeCartItemAction}>
                <input type="hidden" name="itemId" value={e.id} />
                <button type="submit" className="text-xs text-red-600 underline">
                  削除
                </button>
              </form>
            )
          }
        />
      ) : (
        <LocalCart />
      )}
    </div>
  );
}
