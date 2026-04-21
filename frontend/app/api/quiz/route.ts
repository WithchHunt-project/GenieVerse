import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const { userId, conceptId, score, total } = await req.json();

    const { error: insertError } = await supabase.from("quiz_results").insert({
      user_id: userId,
      concept_id: conceptId,
      score,
      total,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // update memory score
    let memoryUpdate = score / total > 0.7 ? 10 : -15;

    const { data: progressData, error: progressError } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("concept_id", conceptId)
      .single();

    if (!progressError && progressData) {
      const newMemoryScore = Math.min(100, Math.max(0, progressData.memory_score + memoryUpdate));
      await supabase
        .from("user_progress")
        .update({
          memory_score: newMemoryScore,
          last_studied_at: new Date(),
          revision_count: (progressData.revision_count || 0) + 1,
        })
        .eq("id", progressData.id);

      // Update digital_twin weak/strong based on memory_score
      const { data: concept } = await supabase.from("concepts").select("subject").eq("id", conceptId).single();
      const subject = concept?.subject || "General";

      const { data: dt } = await supabase.from("digital_twin").select("*").eq("user_id", userId).single();
      const weak_topics: string[] = dt?.weak_topics || [];
      const strong_topics: string[] = dt?.strong_topics || [];

      if (newMemoryScore < 60) {
        if (!weak_topics.includes(subject)) weak_topics.push(subject);
        const idx = strong_topics.indexOf(subject);
        if (idx > -1) strong_topics.splice(idx, 1);
      } else {
        if (!strong_topics.includes(subject)) strong_topics.push(subject);
        const idx = weak_topics.indexOf(subject);
        if (idx > -1) weak_topics.splice(idx, 1);
      }

      const dtPayload = { weak_topics, strong_topics, updated_at: new Date() };
      if (dt) {
        await supabase.from("digital_twin").update(dtPayload).eq("user_id", userId);
      } else {
        await supabase.from("digital_twin").insert({ user_id: userId, ...dtPayload });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
