import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req) {
  try {
    const { studentName, skill, level, score, passed } = await req.json();
    
    const { data, error } = await supabase
      .from('results')
      .insert([{ studentName, skill, level, score, passed }]);

    if (error) {
      throw error;
    }
    
    return NextResponse.json({ message: "Score Saved Successfully" }, { status: 201 });
  } catch (error) {
    console.error("Supabase Save Error:", error);
    return NextResponse.json({ message: "Error: Could not save", details: error.message }, { status: 500 });
  }
} 