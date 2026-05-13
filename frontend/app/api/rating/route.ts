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

    // After rating, try to update detected_interests using ML if enough data
    try {
      const { data: progressRows } = await supabase
        .from("user_progress")
        .select("time_spent_seconds, rating, concept_id")
        .eq("user_id", userId);

      if (progressRows && progressRows.length >= 3) {
        const conceptIds = progressRows.map((r: any) => r.concept_id).filter(Boolean);
        const { data: concepts } = await supabase.from("concepts").select("id, subject").in("id", conceptIds);
        const subjectMap: Record<string, string> = {};
        concepts?.forEach((c: any) => { subjectMap[c.id] = c.subject || "General"; });

        const records = progressRows
          .filter((r: any) => subjectMap[r.concept_id])
          .map((r: any) => ({
            time_spent: r.time_spent_seconds || 0,
            quiz_score: 0,
            revision_count: 0,
            rating: r.rating || 0,
            subject: subjectMap[r.concept_id],
          }));

        if (records.length >= 2) {
          const mlRes = await fetch("http://127.0.0.1:8000/update-interests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, records }),
          });
          const mlData = await mlRes.json();
          if (mlData.updated_interests?.length) {
            await supabase.from("profiles")
              .update({ detected_interests: mlData.updated_interests })
              .eq("id", userId);
          }
        }
      }
    } catch {
      // ML update is best-effort, don't fail the rating save
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
