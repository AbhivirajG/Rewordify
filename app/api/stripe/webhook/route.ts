/**
 * Stripe → Supabase subscription sync.
 *
 * Dashboard checklist:
 * - Webhook URL: https://YOUR_DOMAIN/api/stripe/webhook
 * - Events: checkout.session.completed, customer.subscription.updated,
 *   customer.subscription.deleted
 * - STRIPE_WEBHOOK_SECRET from the webhook signing secret
 * - For local dev: stripe listen --forward-to localhost:3000/api/stripe/webhook
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import {
  cancelSubscriptionInSupabase,
  findUserIdForStripeSubscription,
  syncSubscriptionToSupabase,
} from "@/lib/stripe/sync";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error("Stripe webhook signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.client_reference_id;
        if (!userId) {
          console.warn("checkout.session.completed missing client_reference_id");
          break;
        }

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscriptionToSupabase(sub, userId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (await findUserIdForStripeSubscription(sub)) ??
          undefined;
        if (!userId) {
          console.warn("subscription.updated: unknown user for", sub.id);
          break;
        }
        await syncSubscriptionToSupabase(sub, userId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await cancelSubscriptionInSupabase(sub.id);
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error("Stripe webhook handler error", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
