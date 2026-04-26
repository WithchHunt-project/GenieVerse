import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Fetch user progress with concept details
    const { data: progressRows, error: progressError } = await supabase
      .from("user_progress")
      .select("time_spent, quiz_score, revision_count, rating, concept_id")
      .eq("user_id", userId);

    if (progressError || !progressRows || progressRows.length === 0) {
      // Fallback: use profile detected_interests
      const { data: profile } = await supabase
        .from("profiles")
        .select("detected_interests")
        .eq("id", userId)
        .single();

      const interests = profile?.detected_interests || [];
      if (interests.length > 0) {
        const { data: concepts } = await supabase
          .from("concepts")
          .select("*")
          .overlaps("tags", interests);
        return NextResponse.json(concepts || []);
      }
      const { data: concepts } = await supabase.from("concepts").select("*").limit(5);
      return NextResponse.json(concepts || []);
    }

    // Fetch concept subjects for each progress row
    const conceptIds = progressRows.map((r: any) => r.concept_id).filter(Boolean);
    const { data: concepts } = await supabase
      .from("concepts")
      .select("id, subject")
      .in("id", conceptIds);

    const conceptSubjectMap: Record<string, string> = {};
    concepts?.forEach((c: any) => { conceptSubjectMap[c.id] = c.subject || "General"; });

    // Build records for ML model
    const records = progressRows
      .filter((r: any) => r.concept_id && conceptSubjectMap[r.concept_id])
      .map((r: any) => ({
        time_spent: r.time_spent || 0,
        quiz_score: (r.quiz_score || 0) * 10, // normalize 0-10 → 0-100
        revision_count: r.revision_count || 0,
        rating: r.rating || 0,
        subject: conceptSubjectMap[r.concept_id],
      }));

    let interestedSubjects: string[] = [];

    if (records.length >= 2) {
      try {
        const mlRes = await fetch("http://127.0.0.1:8000/predict-interest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records }),
        });
        const mlData = await mlRes.json();
        interestedSubjects = mlData.interested_subjects || [];
      } catch {
        // ML backend unavailable — fallback to profile interests
      }
    }

    if (interestedSubjects.length === 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("detected_interests")
        .eq("id", userId)
        .single();
      interestedSubjects = profile?.detected_interests || [];
    }

    if (interestedSubjects.length > 0) {
      const { data: recommended } = await supabase
        .from("concepts")
        .select("*")
        .in("subject", interestedSubjects);
      return NextResponse.json(recommended || []);
    }

    const { data: fallback } = await supabase.from("concepts").select("*").limit(5);
    return NextResponse.json(fallback || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
