import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const { data, error } = await supabase
      .from("user_progress")
      .select("concept_id, last_studied_at, quiz_score, revision_count, memory_score")
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json([]);

    const conceptIds = data.map((d: any) => d.concept_id);
    const { data: concepts } = await supabase
      .from("concepts")
      .select("id, name, subject, difficulty")
      .in("id", conceptIds);

    const conceptMap: Record<string, any> = {};
    concepts?.forEach((c: any) => { conceptMap[c.id] = c; });

    const now = Date.now();

    // Build records for ML forgetting model
    const records = data
      .filter((item: any) => conceptMap[item.concept_id])
      .map((item: any) => {
        const lastStudied = item.last_studied_at ? new Date(item.last_studied_at).getTime() : now;
        const days_gap = (now - lastStudied) / (1000 * 60 * 60 * 24);
        return {
          concept_id: item.concept_id,
          subject: conceptMap[item.concept_id]?.subject || "General",
          days_gap,
          quiz_score: item.quiz_score || 0,
          revision_count: item.revision_count || 0,
          difficulty: conceptMap[item.concept_id]?.difficulty || 1,
        };
      });

    let orderedConceptIds: string[] = records.map((r: any) => r.concept_id);

    if (records.length >= 2) {
      try {
        const mlRes = await fetch("http://127.0.0.1:8000/predict-forgetting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records }),
        });
        const mlData = await mlRes.json();
        if (mlData.revise && mlData.revise.length > 0) {
          orderedConceptIds = mlData.revise;
        } else if (mlData.all) {
          orderedConceptIds = mlData.all.map((r: any) => r.concept_id);
        }
      } catch {
        // ML backend unavailable — fallback to days_gap sort
        records.sort((a: any, b: any) => b.days_gap - a.days_gap);
        orderedConceptIds = records.map((r: any) => r.concept_id);
      }
    }

    const revisionList = orderedConceptIds
      .map((cid: string) => {
        const item = data.find((d: any) => d.concept_id === cid);
        return item ? { ...item, concepts: conceptMap[cid] || null } : null;
      })
      .filter(Boolean);

    return NextResponse.json(revisionList);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
