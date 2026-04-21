import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const { data, error } = await supabase
      .from("user_progress")
      .select("concept_id, last_studied_at")
      .eq("user_id", userId)
      .order("last_studied_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json([]);

    const conceptIds = data.map((d: any) => d.concept_id);
    const { data: concepts } = await supabase.from("concepts").select("id, name, subject").in("id", conceptIds);
    const conceptMap: Record<string, any> = {};
    concepts?.forEach((c: any) => { conceptMap[c.id] = c; });

    const revisionList = data.map((item: any) => ({
      ...item,
      concepts: conceptMap[item.concept_id] || null
    }));

    return NextResponse.json(revisionList);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
