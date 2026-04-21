import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const { userId, conceptId, rating } = await req.json();

    const { error } = await supabase
      .from("user_progress")
      .update({ rating })
      .eq("user_id", userId)
      .eq("concept_id", conceptId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
