const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://wdfowvxjbexggpofltae.supabase.co";
const supabaseAnonKey = "sb_publishable_Xn-JwMeY2qNusNVb9otg8g_B99qpR2x";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const { data, error } = await supabase.from("profiles").insert({
    id: "3e5a2db4-c9f2-45e0-9bc3-0d32f508ba41", // random UUID
    username: "TestUser",
    pet_name: "TestPet",
    class: "Class 1",
    initial_interests: ["Space"],
    detected_interests: ["Space"]
  });

  if (error) {
    console.error("ERROR DETAILS:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
  } else {
    console.log("Success! Data:", data);
  }
}

testInsert();
