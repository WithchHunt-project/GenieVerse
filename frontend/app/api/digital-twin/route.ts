import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const { data, error } = await supabase
      .from("digital_twin")
      .select("weak_topics, strong_topics")
      .eq("user_id", userId)
      .single();

    if (error) return NextResponse.json({ strong: [], weak: [] });

    return NextResponse.json({
      strong: data?.strong_topics || [],
      weak: data?.weak_topics || []
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
