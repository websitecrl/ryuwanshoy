


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "series_id" "uuid",
    "title" "text",
    "chapter_number" integer NOT NULL,
    "is_early_access" boolean DEFAULT false,
    "published_at" timestamp without time zone DEFAULT "now"(),
    "created_at" timestamp without time zone DEFAULT "now"(),
    "is_published" boolean DEFAULT false,
    "is_draft" boolean DEFAULT true
);


ALTER TABLE "public"."chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chapter_id" "uuid",
    "series_id" "uuid",
    "name" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "edit_token" "text" NOT NULL,
    "ip_hash" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "post_id" "uuid",
    "parent_id" "uuid"
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."early_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."early_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hero_slides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "series_id" "uuid",
    "chapter_id" "uuid",
    "banner_image" "text",
    "headline" "text",
    "is_visible" boolean DEFAULT false,
    "order_index" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."hero_slides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "like_token" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chapter_id" "uuid",
    "page_number" integer NOT NULL,
    "image_url" "text" NOT NULL,
    "is_spread" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "image_url" "text" NOT NULL,
    "post_type" "text" DEFAULT 'sketch'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "cover_image" "text",
    "banner_image" "text",
    "genre" "text",
    "status" "text" DEFAULT 'ongoing'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "is_published" boolean DEFAULT false,
    "min_age" smallint DEFAULT 13 NOT NULL
);


ALTER TABLE "public"."series" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_title" "text" DEFAULT 'My Comic Site'::"text",
    "creator_name" "text",
    "site_description" "text",
    "logo_url" "text",
    "kofi_url" "text",
    "donation_message" "text",
    "facebook_url" "text",
    "instagram_url" "text",
    "twitter_url" "text",
    "tiktok_url" "text",
    "youtube_url" "text",
    "ea_headline" "text",
    "ea_subtext" "text",
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "patreon_url" "text",
    "paypal_url" "text"
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapter_series_id_chapter_number_unique" UNIQUE ("series_id", "chapter_number");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."early_access"
    ADD CONSTRAINT "early_access_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."early_access"
    ADD CONSTRAINT "early_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hero_slides"
    ADD CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_like_token_key" UNIQUE ("post_id", "like_token");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."series"
    ADD CONSTRAINT "series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."series"
    ADD CONSTRAINT "series_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "settings_single_row" ON "public"."settings" USING "btree" ((true));



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hero_slides"
    ADD CONSTRAINT "hero_slides_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hero_slides"
    ADD CONSTRAINT "hero_slides_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can delete chapters" ON "public"."chapters" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can delete comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can delete early_access" ON "public"."early_access" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can delete hero_slides" ON "public"."hero_slides" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can delete pages" ON "public"."pages" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can delete posts" ON "public"."posts" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can delete series" ON "public"."series" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can insert chapters" ON "public"."chapters" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can insert hero_slides" ON "public"."hero_slides" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can insert pages" ON "public"."pages" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can insert posts" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can insert series" ON "public"."series" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can insert settings" ON "public"."settings" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can read all chapters" ON "public"."chapters" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can read all pages" ON "public"."pages" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can read all series" ON "public"."series" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can read early_access" ON "public"."early_access" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can update chapters" ON "public"."chapters" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can update hero_slides" ON "public"."hero_slides" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can update pages" ON "public"."pages" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can update posts" ON "public"."posts" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can update series" ON "public"."series" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Admin can update settings" ON "public"."settings" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = '190ec053-21ae-42bd-90de-fb0cd7e4f915'::"uuid"));



CREATE POLICY "Anyone can insert likes" ON "public"."likes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read likes" ON "public"."likes" FOR SELECT USING (true);



CREATE POLICY "Public can insert comments" ON "public"."comments" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can read comments" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Public can sign up for early access" ON "public"."early_access" FOR INSERT WITH CHECK (true);



CREATE POLICY "anon can read hero_slides" ON "public"."hero_slides" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "anon can read pages" ON "public"."pages" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."chapters"
  WHERE (("chapters"."id" = "pages"."chapter_id") AND ("chapters"."is_published" = true)))));



CREATE POLICY "anon can read posts" ON "public"."posts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "anon can read published chapters" ON "public"."chapters" FOR SELECT TO "anon" USING (("is_published" = true));



CREATE POLICY "anon can read series" ON "public"."series" FOR SELECT TO "anon" USING (("is_published" = true));



CREATE POLICY "anon can read settings" ON "public"."settings" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."early_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hero_slides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read hero_slides" ON "public"."hero_slides" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."series" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chapters";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."hero_slides";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."likes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."series";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
































































































































































































GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."chapters" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."chapters" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."comments" TO "anon";
GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("chapter_id") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("series_id") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("content") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("is_read") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("post_id") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT("parent_id") ON TABLE "public"."comments" TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."early_access" TO "anon";
GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."early_access" TO "authenticated";
GRANT ALL ON TABLE "public"."early_access" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."hero_slides" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."hero_slides" TO "authenticated";
GRANT ALL ON TABLE "public"."hero_slides" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."likes" TO "anon";
GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."likes" TO "authenticated";



GRANT SELECT("post_id") ON TABLE "public"."likes" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."likes" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."pages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."pages" TO "authenticated";
GRANT ALL ON TABLE "public"."pages" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."posts" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."series" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."series" TO "authenticated";
GRANT ALL ON TABLE "public"."series" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."settings" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";



































