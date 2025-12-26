// Supabase Edge Function for Admin API Operations
// This function handles all admin operations with service role access

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

interface RequestBody {
  action: string;
  data?: Record<string, unknown>;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token to verify they're authenticated
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to verify authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client with service role for operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { action, data } = body;

    let result;

    switch (action) {
      // ============ USER OPERATIONS ============
      case "getUsers":
        result = await adminClient
          .from("user_profiles")
          .select("*")
          .order("created_at", { ascending: false });
        break;

      case "createUser":
        if (!data?.username || !data?.password || !data?.role) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Create auth user
        const email = `${data.username}@cardgame.local`;
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password: data.password as string,
          email_confirm: true,
          user_metadata: { role: data.role },
        });

        if (authError) {
          return new Response(
            JSON.stringify({ error: authError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Set expiration date (100 years for admin, provided date for students)
        let expiresAt: string;
        if (data.role === "admin") {
          const farFuture = new Date();
          farFuture.setFullYear(farFuture.getFullYear() + 100);
          expiresAt = farFuture.toISOString();
        } else {
          expiresAt = data.expires_at as string || new Date().toISOString();
        }

        // Create profile
        const { error: profileCreateError } = await adminClient
          .from("user_profiles")
          .insert({
            user_id: authData.user!.id,
            username: data.username,
            role: data.role,
            subscriptions: data.subscriptions || [],
            expires_at: expiresAt,
          });

        if (profileCreateError) {
          // Rollback auth user
          await adminClient.auth.admin.deleteUser(authData.user!.id);
          return new Response(
            JSON.stringify({ error: profileCreateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = { data: { userId: authData.user!.id }, error: null };
        break;

      case "updateUser":
        if (!data?.userId) {
          return new Response(
            JSON.stringify({ error: "User ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updates: Record<string, unknown> = {};
        if (data.username) updates.username = data.username;
        if (data.role) updates.role = data.role;
        if (data.subscriptions !== undefined) updates.subscriptions = data.subscriptions;
        if (data.expires_at) updates.expires_at = data.expires_at;

        result = await adminClient
          .from("user_profiles")
          .update(updates)
          .eq("user_id", data.userId);

        // Update password if provided
        if (data.password) {
          await adminClient.auth.admin.updateUserById(data.userId as string, {
            password: data.password as string,
          });
        }
        break;

      case "deleteUser":
        if (!data?.userId) {
          return new Response(
            JSON.stringify({ error: "User ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Sign out user sessions
        try {
          await adminClient.auth.admin.signOut(data.userId as string, "global");
        } catch (e) {
          console.log("Could not sign out user:", e);
        }

        // Delete access logs
        await adminClient.from("access_logs").delete().eq("user_id", data.userId);

        // Delete profile
        await adminClient.from("user_profiles").delete().eq("user_id", data.userId);

        // Delete auth user
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.userId as string);
        
        result = { data: { success: true }, error: deleteError };
        break;

      case "forceLogout":
        if (!data?.userId) {
          return new Response(
            JSON.stringify({ error: "User ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update force_logout_at and clear session_token
        const { error: forceLogoutError } = await adminClient
          .from("user_profiles")
          .update({ 
            force_logout_at: new Date().toISOString(),
            session_token: null,
          })
          .eq("user_id", data.userId);

        if (forceLogoutError) {
          return new Response(
            JSON.stringify({ error: forceLogoutError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Also sign out all sessions via Supabase Admin API
        try {
          await adminClient.auth.admin.signOut(data.userId as string, "global");
        } catch (e) {
          console.log("Could not sign out via admin API:", e);
        }

        result = { data: { success: true }, error: null };
        break;

      // ============ CARD OPERATIONS ============
      case "getCards":
        result = await adminClient
          .from("cards")
          .select("*")
          .order("created_at", { ascending: false });
        break;

      case "createCard":
        if (!data?.card_id || !data?.video_url) {
          return new Response(
            JSON.stringify({ error: "Card ID and video URL required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = await adminClient
          .from("cards")
          .insert({
            card_id: data.card_id,
            video_url: data.video_url,
            title: data.title || null,
            subject: data.subject || null,
            required_subscriptions: data.required_subscriptions || [],
          })
          .select()
          .single();
        break;

      case "updateCard":
        if (!data?.id) {
          return new Response(
            JSON.stringify({ error: "Card ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cardUpdates: Record<string, unknown> = {};
        if (data.video_url) cardUpdates.video_url = data.video_url;
        if (data.title !== undefined) cardUpdates.title = data.title;
        if (data.subject !== undefined) cardUpdates.subject = data.subject;
        if (data.required_subscriptions !== undefined) cardUpdates.required_subscriptions = data.required_subscriptions;

        result = await adminClient
          .from("cards")
          .update(cardUpdates)
          .eq("id", data.id)
          .select()
          .single();
        break;

      case "deleteCard":
        if (!data?.id) {
          return new Response(
            JSON.stringify({ error: "Card ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = await adminClient.from("cards").delete().eq("id", data.id);
        break;

      // ============ ACCESS LOG OPERATIONS ============
      case "getAccessLogs":
        let query = adminClient
          .from("access_logs")
          .select(`
            *,
            user_profiles(username),
            cards(title)
          `)
          .order("accessed_at", { ascending: false });

        if (data?.userId) query = query.eq("user_id", data.userId);
        if (data?.cardId) query = query.eq("card_id", data.cardId);
        if (data?.startDate) query = query.gte("accessed_at", data.startDate);
        if (data?.endDate) query = query.lte("accessed_at", data.endDate);

        result = await query;
        break;

      case "logAccess":
        if (!data?.userId || !data?.cardId) {
          return new Response(
            JSON.stringify({ error: "User ID and Card ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = await adminClient
          .from("access_logs")
          .insert({
            user_id: data.userId,
            card_id: data.cardId,
            accessed_at: new Date().toISOString(),
          });
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (result.error) {
      return new Response(
        JSON.stringify({ error: result.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ data: result.data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
