import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const session = await auth();

    // User must be logged in to fork
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { shareId } = await request.json();

    if (!shareId) {
      return new Response(JSON.stringify({ error: "shareId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the original chat from the share ID
    const share = await db.getPublicShare(shareId);

    if (!share) {
      return new Response(JSON.stringify({ error: "Shared chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fork the chat
    const newChatId = await db.forkChat(share.chatId, session.user.id);

    return NextResponse.json({ newChatId });
  } catch (error) {
    console.error("Fork API error:", error);
    return new Response(JSON.stringify({ error: "Failed to fork chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
