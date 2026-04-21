import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("detected_interests")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const interests = profile.detected_interests || [];
    
    let conceptsData = [];
    if (interests.length > 0) {
      const { data: concepts, error: conceptsError } = await supabase
        .from("concepts")
        .select("*")
        .overlaps("tags", interests);
      
      if (!conceptsError) {
        conceptsData = concepts || [];
      }
    } else {
      // Fallback: just return some random concepts
      const { data: concepts } = await supabase.from("concepts").select("*").limit(5);
      conceptsData = concepts || [];
    }

    return NextResponse.json(conceptsData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
