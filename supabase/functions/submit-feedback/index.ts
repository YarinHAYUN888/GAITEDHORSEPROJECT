import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { analysisId, feedbackType, correctedGaitType, keypointCorrections, rating, comment, isExpert, labelSource } = body;

    if (!analysisId || !feedbackType) {
      return new Response(JSON.stringify({ error: "analysisId and feedbackType are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user owns the analysis
    const { data: analysis, error: analysisError } = await supabase
      .from("gait_analyses")
      .select("id, user_id, result_json")
      .eq("id", analysisId)
      .single();

    if (analysisError || !analysis) {
      return new Response(JSON.stringify({ error: "Analysis not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (analysis.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert feedback
    const { data: feedback, error: insertError } = await supabase
      .from("analysis_feedback")
      .insert({
        analysis_id: analysisId,
        user_id: userId,
        feedback_type: feedbackType,
        corrected_gait_type: correctedGaitType || null,
        keypoint_corrections: keypointCorrections || null,
        rating: rating || null,
        comment: comment || null,
        is_expert: isExpert || false,
        label_source: labelSource || "user",
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If gait correction, mark analysis as human_validated
    if (feedbackType === "gait_correction" && correctedGaitType) {
      await supabase
        .from("gait_analyses")
        .update({ human_validated: true })
        .eq("id", analysisId);
    }

    // If recommendation rating, also mark as validated
    if (feedbackType === "recommendation_rating" && rating) {
      await supabase
        .from("gait_analyses")
        .update({ human_validated: true })
        .eq("id", analysisId);
    }

    // Call label-feedback asynchronously to generate tags — fire and forget
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const labelBody = {
          resultJson: analysis.result_json || {},
          correctedGaitType: correctedGaitType || null,
          comment: comment || null,
          feedbackType,
          labelSource: labelSource || "user",
        };

        const functionsBase = Deno.env.get("SUPABASE_URL");
        const labelResponse = await fetch(`${functionsBase}/functions/v1/label-feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify(labelBody),
        });

        if (labelResponse.ok) {
          const labelResult = await labelResponse.json();
          // Update feedback with tags and evidence
          if (labelResult.tags || labelResult.evidence) {
            await supabase
              .from("analysis_feedback")
              .update({
                tags: labelResult.tags || [],
                evidence: labelResult.evidence || [],
              })
              .eq("id", feedback.id);
          }
        } else {
          // Consume body to prevent leak
          await labelResponse.text();
          console.warn("label-feedback call failed, continuing without tags");
        }
      }
    } catch (labelErr) {
      console.warn("label-feedback error (non-critical):", labelErr);
    }

    return new Response(JSON.stringify({ success: true, feedbackId: feedback.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
