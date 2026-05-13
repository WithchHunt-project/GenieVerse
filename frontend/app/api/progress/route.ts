import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const { userId, conceptId, timeSpent } = await req.json();

    // Insert a new progress row (user_progress has no unique constraint, each session is a row)
    const { error: progressError } = await supabase
      .from("user_progress")
      .insert({ user_id: userId, concept_id: conceptId, time_spent_seconds: timeSpent });

    if (progressError) {
      console.error("user_progress insert error:", progressError);
      return NextResponse.json({ error: progressError.message }, { status: 500 });
    }

    // Fetch concept subject for digital_twin topic tracking
    const { data: concept } = await supabase.from("concepts").select("subject").eq("id", conceptId).single();
    const subject = concept?.subject || "General";

    // Get existing digital_twin row for this user+concept
    const { data: existing } = await supabase
      .from("digital_twin")
      .select("revision_count, memory_score")
      .eq("user_id", userId)
      .eq("concept_id", conceptId)
      .single();

    const revision_count = (existing?.revision_count || 0) + 1;
    const memory_score = Math.min(100, (existing?.memory_score || 50) + 10);

    // Upsert digital_twin row (has primary key on user_id, concept_id)
    await supabase.from("digital_twin").upsert({
      user_id: userId,
      concept_id: conceptId,
      last_studied_at: new Date(),
      revision_count,
      memory_score,
    }, { onConflict: "user_id,concept_id" });

    // Update weak/strong topics on a separate digital_twin summary row keyed only by user
    // We track this in the profile's detected_interests instead — no action needed here

    return NextResponse.json({ success: true, revision_count, subject });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
