import type { Stripe } from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export type SubscriptionTier = "free" | "pro" | "max";

export function tierFromStripePriceId(priceId: string | undefined): SubscriptionTier {
  if (priceId && process.env.STRIPE_PRICE_ID_MAX && priceId === process.env.STRIPE_PRICE_ID_MAX) {
    return "max";
  }
  if (priceId && process.env.STRIPE_PRICE_ID_PRO && priceId === process.env.STRIPE_PRICE_ID_PRO) {
    return "pro";
  }
  // Payment-Link-only setup: no price envs → treat paid subscription as Pro.
  if (priceId) return "pro";
  return "free";
}

export async function syncSubscriptionToSupabase(
  sub: Stripe.Subscription,
  supabaseUserId: string,
): Promise<void> {
  const admin = createAdminClient();
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price.id;
  const tier = tierFromStripePriceId(priceId);
  const activeLike = sub.status === "active" || sub.status === "trialing";
  const periodEndUnix = (sub as unknown as { current_period_end: number })
    .current_period_end;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: supabaseUserId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      tier: activeLike ? tier : "free",
      price_id: priceId ?? null,
      current_period_end: new Date(periodEndUnix * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("syncSubscriptionToSupabase", error);
    throw error;
  }
}

export async function findUserIdForStripeSubscription(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const admin = createAdminClient();
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: bySub } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (bySub?.user_id) return bySub.user_id;

  const { data: byCust } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return byCust?.user_id ?? null;
}

export async function cancelSubscriptionInSupabase(
  stripeSubscriptionId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      tier: "free",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (error) {
    console.error("cancelSubscriptionInSupabase", error);
    throw error;
  }
}
