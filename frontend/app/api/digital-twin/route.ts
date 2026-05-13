import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Get all digital_twin rows for this user
    const { data: dtRows } = await supabase
      .from("digital_twin")
      .select("concept_id, revision_count, memory_score, last_studied_at")
      .eq("user_id", userId);

    if (!dtRows || dtRows.length === 0) return NextResponse.json({ strong: [], weak: [] });

    const conceptIds = dtRows.map((r: any) => r.concept_id);
    const { data: concepts } = await supabase
      .from("concepts")
      .select("id, name, subject")
      .in("id", conceptIds);

    const conceptMap: Record<string, any> = {};
    concepts?.forEach((c: any) => { conceptMap[c.id] = c; });

    const strong: string[] = [];
    const weak: string[] = [];

    dtRows.forEach((row: any) => {
      const subject = conceptMap[row.concept_id]?.subject || "General";
      if (row.revision_count >= 3 && row.memory_score >= 70) {
        if (!strong.includes(subject)) strong.push(subject);
      } else {
        if (!weak.includes(subject)) weak.push(subject);
      }
    });

    return NextResponse.json({ strong, weak });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
