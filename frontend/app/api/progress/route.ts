import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const { userId, conceptId, timeSpent } = await req.json();
    console.log("Progress API called:", { userId, conceptId, timeSpent });

    const { error } = await supabase
      .from("user_progress")
      .upsert({
        user_id: userId,
        concept_id: conceptId,
        time_spent: timeSpent,
        last_studied_at: new Date(),
      }, { onConflict: "user_id,concept_id" });

    if (error) {
      console.error("user_progress upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch concept subject
    const { data: concept } = await supabase.from("concepts").select("subject").eq("id", conceptId).single();
    const subject = concept?.subject || "General";

    // Get existing user_progress row
    const { data: existing } = await supabase.from("user_progress").select("revision_count, memory_score").eq("user_id", userId).eq("concept_id", conceptId).single();
    const revision_count = (existing?.revision_count || 0) + 1;
    const memory_score = Math.min(100, (existing?.memory_score || 50) + 10);

    await supabase.from("user_progress").update({ revision_count, memory_score }).eq("user_id", userId).eq("concept_id", conceptId);

    // Update digital_twin strong/weak topics
    const { data: dt } = await supabase.from("digital_twin").select("*").eq("user_id", userId).single();
    const weak_topics: string[] = dt?.weak_topics || [];
    const strong_topics: string[] = dt?.strong_topics || [];
    const total_revisions = (dt?.revision_count || 0) + 1;

    if (!strong_topics.includes(subject) && !weak_topics.includes(subject)) {
      weak_topics.push(subject);
    }
    if (total_revisions > 3 && weak_topics.includes(subject)) {
      weak_topics.splice(weak_topics.indexOf(subject), 1);
      if (!strong_topics.includes(subject)) strong_topics.push(subject);
    }

    const dtPayload = { revision_count: total_revisions, weak_topics, strong_topics, updated_at: new Date() };
    if (dt) {
      await supabase.from("digital_twin").update(dtPayload).eq("user_id", userId);
    } else {
      await supabase.from("digital_twin").insert({ user_id: userId, ...dtPayload });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
