/**
 * Clerk Webhook Handler (DISABLED)
 * Syncs Clerk user events with database
 * Endpoint: POST /api/webhooks/clerk
 * 
 * To enable: pnpm add svix
 */

export async function POST(req: Request) {
  // Webhook temporarily disabled - svix not installed
  console.log("Webhook received but disabled (install svix to enable)");
  
  return new Response(
    JSON.stringify({ 
      message: "Webhook disabled - install svix to enable",
      note: "Run: pnpm add svix",
    }), 
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
