const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://wdfowvxjbexggpofltae.supabase.co";
const supabaseAnonKey = "sb_publishable_Xn-JwMeY2qNusNVb9otg8g_B99qpR2x";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  console.log("Checking profiles...");
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*").limit(5);
  console.log("Profiles:", pErr ? pErr : profiles);

  console.log("\nChecking concepts...");
  const { data: concepts, error: cErr } = await supabase.from("concepts").select("*").limit(2);
  console.log("Concepts:", cErr ? cErr : concepts);

  if (profiles && profiles.length > 0) {
    console.log("\nTesting overlaps with:", profiles[0].detected_interests);
    const { data: matches, error: mErr } = await supabase
      .from("concepts")
      .select("*")
      .overlaps("tags", profiles[0].detected_interests);
    console.log("Matches:", mErr ? mErr : matches);
  }
}

checkDatabase();
