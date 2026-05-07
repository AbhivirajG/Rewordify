import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Each Stripe Payment Link should contain a single subscription price. If a link
// lists Pro and Max together, Stripe charges both on one checkout.

export const runtime = "nodejs";

type Tier = "pro" | "max";

function paymentLinkForTier(tier: Tier): string | undefined {
  if (tier === "max") {
    return process.env.NEXT_PUBLIC_STRIPE_MAX_PAYMENT_LINK;
  }
  return process.env.NEXT_PUBLIC_STRIPE_PRO_PAYMENT_LINK;
}

/**
 * Returns an authenticated user's Stripe Payment Link URL with
 * client_reference_id = Supabase user id (server-verified).
 */
export async function POST(req: Request) {
  let body: { tier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tier: Tier = body.tier === "max" ? "max" : "pro";
  const base = paymentLinkForTier(tier);
  if (!base?.trim()) {
    const msg =
      tier === "max"
        ? "Max checkout is not available yet."
        : "Stripe Pro payment link is not configured.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return NextResponse.json({ error: "Invalid payment link URL." }, { status: 500 });
  }

  url.searchParams.set("client_reference_id", user.id);
  const email = user.email;
  if (email) {
    url.searchParams.set("prefilled_email", email);
  }

  return NextResponse.json({ url: url.toString() });
}
