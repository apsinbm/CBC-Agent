// app/api/chat/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { message } = await req.json();

    // If no message provided
    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 }
      );
    }

    // --- Temporary placeholder response ---
    const reply = `Alonso heard: ${message}`;
    // --------------------------------------

    return NextResponse.json({ reply }, { status: 200 });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Something went wrong: " + err.message },
      { status: 500 }
    );
  }
}