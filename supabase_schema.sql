


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."decrement_variant_stock"("p_variant_id" bigint, "p_quantity" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_stock integer;
BEGIN
  SELECT stock INTO v_current_stock
  FROM public.product_variants
  WHERE id = p_variant_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La variante seleccionada (ID %) ya no se encuentra disponible.', p_variant_id;
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente para la variante (ID %). Disponible: %, Solicitado: %.', p_variant_id, v_current_stock, p_quantity;
  END IF;

  UPDATE public.product_variants
  SET stock = stock - p_quantity,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_variant_id;
END;
$$;


ALTER FUNCTION "public"."decrement_variant_stock"("p_variant_id" bigint, "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ BEGIN   INSERT INTO public.profiles (     id,     first_name,     paternal_surname,     maternal_surname,     dni,     email,     phone,     role   )   VALUES (     new.id,     COALESCE(new.raw_user_meta_data->>'first_name', 'Usuario'),     COALESCE(new.raw_user_meta_data->>'paternal_surname', ''),     new.raw_user_meta_data->>'maternal_surname',     new.raw_user_meta_data->>'dni',     new.email,     COALESCE(new.raw_user_meta_data->>'phone', ''),     COALESCE(new.raw_user_meta_data->>'role', 'customer')   );   RETURN new; END; $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_delivery"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'delivery'
    );
$$;


ALTER FUNCTION "public"."is_delivery"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'owner'
    );
$$;


ALTER FUNCTION "public"."is_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_checkout_stock"("p_reservation_token" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.stock_reservations
    SET status = 'released'
    WHERE reservation_token = p_reservation_token
      AND status = 'reserved';

    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."release_checkout_stock"("p_reservation_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_checkout_stock"("p_items" "jsonb", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_token UUID := gen_random_uuid();
    v_item RECORD;
    v_physical_stock INT;
    v_active_reserved INT;
    v_available_stock INT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'EMPTY_CART', 'message', 'El carrito no contiene prendas.');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(variant_id BIGINT, quantity INT)
    LOOP
        SELECT stock INTO v_physical_stock
        FROM public.product_variants
        WHERE id = v_item.variant_id AND is_active = TRUE
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error_code', 'VARIANT_NOT_FOUND', 
                'message', format('La variante con ID %s no existe o está inactiva.', v_item.variant_id)
            );
        END IF;

        -- Sumar reservas vigentes usando variant_id estandarizado
        SELECT COALESCE(SUM(quantity), 0) INTO v_active_reserved
        FROM public.stock_reservations
        WHERE variant_id = v_item.variant_id
          AND status = 'reserved'
          AND expires_at > v_now;

        v_available_stock := v_physical_stock - v_active_reserved;

        IF v_available_stock < v_item.quantity THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error_code', 'INSUFFICIENT_STOCK', 
                'message', format('Inventario insuficiente para una de las prendas. Stock disponible: %s, solicitado: %s.', v_available_stock, v_item.quantity),
                'variant_id', v_item.variant_id,
                'available_stock', v_available_stock
            );
        END IF;

        -- Insertar reserva temporal
        INSERT INTO public.stock_reservations (
            reservation_token,
            user_id,
            variant_id,
            quantity,
            status,
            created_at,
            expires_at
        ) VALUES (
            v_token,
            p_user_id,
            v_item.variant_id,
            v_item.quantity,
            'reserved',
            v_now,
            v_now + INTERVAL '10 minutes'
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'reservation_token', v_token,
        'expires_at', (v_now + INTERVAL '10 minutes')
    );
END;
$$;


ALTER FUNCTION "public"."reserve_checkout_stock"("p_items" "jsonb", "p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."verify_checkout_preflight"("p_reservation_token" "uuid" DEFAULT NULL::"uuid", "p_delivery_type" "text" DEFAULT 'scheduled'::"text", "p_total_items" integer DEFAULT 1, "p_scheduled_time_slot" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_now_lima TIMESTAMPTZ := (NOW() AT TIME ZONE 'America/Lima');
    v_current_dow TEXT := EXTRACT(DOW FROM v_now_lima)::TEXT;
    v_current_time TIME := v_now_lima::TIME;
    v_emergency JSONB;
    v_hours JSONB;
    v_day_schedule JSONB;
    v_open TIME;
    v_cutoff TIME;
    v_reservation_count INT;
    v_active_drivers INT;
BEGIN
    -- A. Validar vigencia de la reserva si se envió token
    IF p_reservation_token IS NOT NULL THEN
        SELECT COUNT(*) INTO v_reservation_count
        FROM public.stock_reservations
        WHERE reservation_token = p_reservation_token
          AND status = 'reserved'
          AND expires_at > v_now;

        IF v_reservation_count = 0 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error_code', 'RESERVATION_EXPIRED', 
                'message', 'El tiempo de reserva de tus prendas (10 minutos) ha expirado. Por favor, actualiza tu compra.'
            );
        END IF;
    END IF;

    -- B. Validar estado general de emergencia
    SELECT value INTO v_emergency FROM public.store_settings WHERE key = 'emergency_flags';
    IF v_emergency IS NOT NULL AND (v_emergency->>'close_store_today')::BOOLEAN = TRUE THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error_code', 'STORE_CLOSED_EMERGENCY', 
            'message', 'La tienda ha suspendido temporalmente la recepción de pedidos por hoy.'
        );
    END IF;

    -- C. Validaciones exclusivas de Envío Express
    IF p_delivery_type = 'express' THEN
        IF v_emergency IS NOT NULL AND (v_emergency->>'pause_express_only')::BOOLEAN = TRUE THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error_code', 'EXPRESS_PAUSED', 
                'message', 'El servicio de delivery Express se encuentra pausado temporalmente.'
            );
        END IF;

        IF p_total_items > 30 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error_code', 'MAX_CAPACITY_EXCEEDED', 
                'message', 'El pedido excede la capacidad máxima de una unidad motorizada (máximo 30 prendas).'
            );
        END IF;

        SELECT value INTO v_hours FROM public.store_settings WHERE key = 'business_hours';
        IF v_hours IS NOT NULL THEN
            v_day_schedule := v_hours->v_current_dow;

            IF v_day_schedule IS NULL OR (v_day_schedule->>'enabled')::BOOLEAN = FALSE THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'error_code', 'NON_WORKING_DAY', 
                    'message', 'Hoy no es día laborable para despachos Express.'
                );
            END IF;

            v_open := (v_day_schedule->>'open')::TIME;
            v_cutoff := (v_day_schedule->>'express_cutoff')::TIME;

            IF v_current_time < v_open OR v_current_time > v_cutoff THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'error_code', 'EXPRESS_OUT_OF_HOURS', 
                    'message', format('El servicio Express atiende de %s hasta las %s. Fuera de ese rango solo se admite envío programado.', v_open, v_cutoff)
                );
            END IF;
        END IF;

        -- Validar repartidores activos en profiles
        SELECT COUNT(*) INTO v_active_drivers
        FROM public.profiles
        WHERE role = 'delivery'
          AND is_active = TRUE
          AND is_on_duty = TRUE;

        IF v_active_drivers = 0 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error_code', 'NO_DRIVERS_AVAILABLE', 
                'message', 'No hay repartidores en turno disponibles para despacho Express.'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Pre-flight check aprobado con éxito.'
    );
END;
$$;


ALTER FUNCTION "public"."verify_checkout_preflight"("p_reservation_token" "uuid", "p_delivery_type" "text", "p_total_items" integer, "p_scheduled_time_slot" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "zone_id" bigint NOT NULL,
    "alias" character varying(30) DEFAULT 'Principal'::character varying NOT NULL,
    "receiver_name" character varying(120) NOT NULL,
    "receiver_phone" character varying(20) NOT NULL,
    "department" character varying(30) DEFAULT 'Lima'::character varying NOT NULL,
    "province" character varying(30) DEFAULT 'Lima'::character varying NOT NULL,
    "street_address" "text" NOT NULL,
    "reference" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "latitude" double precision,
    "longitude" double precision
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


ALTER TABLE "public"."addresses" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."addresses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" bigint NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


ALTER TABLE "public"."brands" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."brands_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "variant_id" bigint,
    "quantity" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cart_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" bigint NOT NULL,
    "name" character varying(50) NOT NULL,
    "slug" character varying(60) NOT NULL,
    "description" "text",
    "image_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "parent_id" bigint,
    "target_genders" "text"[] DEFAULT ARRAY['hombre'::"text", 'mujer'::"text", 'nino'::"text", 'nina'::"text"]
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


ALTER TABLE "public"."categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."delivery_zones" (
    "id" bigint NOT NULL,
    "district_name" character varying(60) NOT NULL,
    "delivery_cost" numeric(10,2) NOT NULL,
    "estimated_delivery_time" character varying(50) DEFAULT '24 a 48 horas'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "delivery_zones_delivery_cost_check" CHECK (("delivery_cost" >= (0)::numeric))
);


ALTER TABLE "public"."delivery_zones" OWNER TO "postgres";


ALTER TABLE "public"."delivery_zones" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."delivery_zones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."identity_cache" (
    "id" bigint NOT NULL,
    "document_type" character varying NOT NULL,
    "document_number" character varying NOT NULL,
    "data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."identity_cache" OWNER TO "postgres";


ALTER TABLE "public"."identity_cache" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."identity_cache_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" bigint NOT NULL,
    "name" character varying(50) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


ALTER TABLE "public"."materials" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."materials_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" bigint NOT NULL,
    "order_id" "uuid" NOT NULL,
    "variant_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "order_items_check" CHECK (("subtotal" = (("quantity")::numeric * "unit_price"))),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_unit_price_check" CHECK (("unit_price" > (0)::numeric))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


ALTER TABLE "public"."order_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" character varying(20) NOT NULL,
    "customer_id" "uuid",
    "shipping_address_id" bigint,
    "assigned_delivery_id" "uuid",
    "delivery_type" character varying(20) NOT NULL,
    "delivery_cost" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "payment_method" character varying(20) NOT NULL,
    "payment_gateway_tx_id" character varying(100),
    "status" character varying(30) DEFAULT 'pendiente_pago'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "invoice_type" character varying(20) DEFAULT 'none'::character varying,
    "invoice_data" "jsonb" DEFAULT '{}'::"jsonb",
    "customer_name" character varying,
    "customer_email" character varying,
    "customer_phone" character varying,
    "delivery_address" "text",
    "scheduled_time_slot" character varying,
    "payment_status" character varying DEFAULT 'pending_verification'::character varying,
    "delivery_latitude" double precision,
    "delivery_longitude" double precision,
    "incident_reason" character varying(100),
    "incident_comment" "text",
    "shipping_type" "text",
    CONSTRAINT "orders_check" CHECK (("total_amount" = ("subtotal" + "delivery_cost"))),
    CONSTRAINT "orders_delivery_cost_check" CHECK (("delivery_cost" >= (0)::numeric)),
    CONSTRAINT "orders_delivery_type_check" CHECK ((("delivery_type")::"text" = ANY ((ARRAY['express'::character varying, 'programado'::character varying, 'scheduled'::character varying, 'recojo'::character varying, 'pickup'::character varying])::"text"[]))),
    CONSTRAINT "orders_invoice_type_check" CHECK (((("invoice_type")::"text" = ANY ((ARRAY['none'::character varying, 'boleta'::character varying, 'factura'::character varying, 'sin_comprobante'::character varying, ''::character varying])::"text"[])) OR ("invoice_type" IS NULL))),
    CONSTRAINT "orders_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['yape_plin'::character varying, 'culqi_gateway'::character varying, 'transferencia'::character varying, 'tarjeta'::character varying, 'contraentrega'::character varying, 'efectivo'::character varying])::"text"[]))),
    CONSTRAINT "orders_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('recibido'::character varying)::"text", ('received'::character varying)::"text", ('pendiente_pago'::character varying)::"text", ('pending'::character varying)::"text", ('en_preparacion'::character varying)::"text", ('preparing'::character varying)::"text", ('por_asignar_repartidor'::character varying)::"text", ('asignado'::character varying)::"text", ('listo_recojo'::character varying)::"text", ('en_camino'::character varying)::"text", ('dispatched'::character varying)::"text", ('cerca'::character varying)::"text", ('nearby'::character varying)::"text", ('en_destino'::character varying)::"text", ('arrived'::character varying)::"text", ('entregado'::character varying)::"text", ('delivered'::character varying)::"text", ('cancelado'::character varying)::"text", ('cancelled'::character varying)::"text", ('incidencia_transporte'::character varying)::"text"]))),
    CONSTRAINT "orders_subtotal_check" CHECK (("subtotal" > (0)::numeric))
);

ALTER TABLE ONLY "public"."orders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_color_images" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "color" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "is_cover" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_color_images" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_color_images_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_color_images_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_color_images_id_seq" OWNED BY "public"."product_color_images"."id";



CREATE TABLE IF NOT EXISTS "public"."product_variants" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "size_id" bigint NOT NULL,
    "color" character varying(40) NOT NULL,
    "color_hex" character varying(7) DEFAULT '#000000'::character varying NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "sku" character varying(50) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "image_url" "text",
    CONSTRAINT "product_variants_color_hex_check" CHECK ((("color_hex")::"text" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "product_variants_stock_check" CHECK (("stock" >= 0))
);

ALTER TABLE ONLY "public"."product_variants" REPLICA IDENTITY FULL;


ALTER TABLE "public"."product_variants" OWNER TO "postgres";


ALTER TABLE "public"."product_variants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."product_variants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" bigint NOT NULL,
    "category_id" bigint NOT NULL,
    "material_id" bigint NOT NULL,
    "name" character varying(120) NOT NULL,
    "slug" character varying(140) NOT NULL,
    "description" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "main_image_url" "text" NOT NULL,
    "gallery_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "has_size_guide" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_on_sale" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "target_gender" character varying(10) DEFAULT 'unisex'::character varying NOT NULL,
    "brand_id" bigint,
    CONSTRAINT "products_price_check" CHECK (("price" > (0)::numeric)),
    CONSTRAINT "products_target_gender_check" CHECK ((("target_gender")::"text" = ANY ((ARRAY['hombre'::character varying, 'mujer'::character varying, 'nino'::character varying, 'nina'::character varying, 'unisex'::character varying])::"text"[])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


ALTER TABLE "public"."products" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "dni" character varying(8),
    "first_name" character varying(60) NOT NULL,
    "paternal_surname" character varying(60) NOT NULL,
    "maternal_surname" character varying(60),
    "email" character varying(255) NOT NULL,
    "phone" character varying(20) NOT NULL,
    "role" character varying(20) DEFAULT 'customer'::character varying NOT NULL,
    "height_cm" smallint,
    "weight_kg" smallint,
    "fit_preference" character varying(20),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "body_measurements" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_on_duty" boolean DEFAULT true NOT NULL,
    "operational_status" character varying(20) DEFAULT 'available'::character varying,
    "delivery_type" character varying(20) DEFAULT 'express'::character varying,
    CONSTRAINT "profiles_dni_check" CHECK ((("dni")::"text" ~ '^[0-9]{8}$'::"text")),
    CONSTRAINT "profiles_fit_preference_check" CHECK ((("fit_preference")::"text" = ANY ((ARRAY['tight'::character varying, 'regular'::character varying, 'loose'::character varying])::"text"[]))),
    CONSTRAINT "profiles_height_cm_check" CHECK ((("height_cm" >= 100) AND ("height_cm" <= 250))),
    CONSTRAINT "profiles_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['customer'::character varying, 'owner'::character varying, 'delivery'::character varying])::"text"[]))),
    CONSTRAINT "profiles_weight_kg_check" CHECK ((("weight_kg" >= 30) AND ("weight_kg" <= 250)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."size_guides" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "size_id" bigint NOT NULL,
    "measurements" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."size_guides" OWNER TO "postgres";


ALTER TABLE "public"."size_guides" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."size_guides_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sizes" (
    "id" bigint NOT NULL,
    "name" character varying(20) NOT NULL,
    "display_order" smallint DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "target_genders" "text"[] DEFAULT '{hombre,mujer}'::"text"[] NOT NULL,
    CONSTRAINT "sizes_target_genders_check" CHECK (("target_genders" <@ ARRAY['hombre'::"text", 'mujer'::"text", 'nino'::"text", 'nina'::"text"]))
);


ALTER TABLE "public"."sizes" OWNER TO "postgres";


ALTER TABLE "public"."sizes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."sizes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stock_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_token" "uuid" NOT NULL,
    "user_id" "uuid",
    "variant_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "status" character varying(20) DEFAULT 'reserved'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'America/Lima'::"text") NOT NULL,
    "expires_at" timestamp with time zone DEFAULT (("now"() AT TIME ZONE 'America/Lima'::"text") + '00:10:00'::interval) NOT NULL,
    CONSTRAINT "stock_reservations_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "stock_reservations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['reserved'::character varying, 'confirmed'::character varying, 'released'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "yape_qr_url" "text",
    "yape_phone" character varying(20),
    "yape_holder_name" character varying(120),
    "plin_qr_url" "text",
    "plin_phone" character varying(20),
    "plin_holder_name" character varying(120),
    "yape_enabled" boolean DEFAULT true,
    "plin_enabled" boolean DEFAULT false,
    "store_closed" boolean DEFAULT false,
    "pause_express" boolean DEFAULT false,
    "pause_scheduled" boolean DEFAULT false,
    "pause_pickup" boolean DEFAULT false,
    "delivery_hyperlocal_enabled" boolean DEFAULT true,
    "delivery_hyperlocal_distance_km" numeric(4,2) DEFAULT 0.80,
    "delivery_hyperlocal_fee" numeric(6,2) DEFAULT 3.50
);


ALTER TABLE "public"."store_settings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_product_variants_available" WITH ("security_invoker"='true') AS
 SELECT "id",
    "product_id",
    "size_id",
    "color",
    "color_hex",
    "sku",
    "is_active",
    "stock" AS "physical_stock",
    (GREATEST((0)::bigint, ("stock" - COALESCE(( SELECT "sum"("sr"."quantity") AS "sum"
           FROM "public"."stock_reservations" "sr"
          WHERE (("sr"."variant_id" = "pv"."id") AND (("sr"."status")::"text" = 'reserved'::"text") AND ("sr"."expires_at" > "now"()))), (0)::bigint))))::integer AS "available_stock"
   FROM "public"."product_variants" "pv";


ALTER VIEW "public"."v_product_variants_available" OWNER TO "postgres";


ALTER TABLE ONLY "public"."product_color_images" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_color_images_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_variant_id_key" UNIQUE ("user_id", "variant_id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."delivery_zones"
    ADD CONSTRAINT "delivery_zones_district_name_key" UNIQUE ("district_name");



ALTER TABLE ONLY "public"."delivery_zones"
    ADD CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identity_cache"
    ADD CONSTRAINT "identity_cache_document_number_key" UNIQUE ("document_number");



ALTER TABLE ONLY "public"."identity_cache"
    ADD CONSTRAINT "identity_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_color_images"
    ADD CONSTRAINT "product_color_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_dni_key" UNIQUE ("dni");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."size_guides"
    ADD CONSTRAINT "size_guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sizes"
    ADD CONSTRAINT "sizes_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."sizes"
    ADD CONSTRAINT "sizes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_reservations"
    ADD CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_settings"
    ADD CONSTRAINT "store_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "uq_product_size_color" UNIQUE ("product_id", "size_id", "color");



ALTER TABLE ONLY "public"."size_guides"
    ADD CONSTRAINT "uq_product_size_guide" UNIQUE ("product_id", "size_id");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_prod_color_images_lookup" ON "public"."product_color_images" USING "btree" ("product_id", "color");



CREATE INDEX "idx_products_brand_id" ON "public"."products" USING "btree" ("brand_id");



CREATE INDEX "idx_stock_reservations_lookup" ON "public"."stock_reservations" USING "btree" ("variant_id", "status", "expires_at");



CREATE INDEX "idx_stock_reservations_token" ON "public"."stock_reservations" USING "btree" ("reservation_token");



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_delivery_id_fkey" FOREIGN KEY ("assigned_delivery_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shipping_address_id_fkey" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."addresses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_color_images"
    ADD CONSTRAINT "product_color_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "public"."sizes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."size_guides"
    ADD CONSTRAINT "size_guides_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."size_guides"
    ADD CONSTRAINT "size_guides_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "public"."sizes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_reservations"
    ADD CONSTRAINT "stock_reservations_product_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_reservations"
    ADD CONSTRAINT "stock_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Escritura exclusiva para administradores" ON "public"."store_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'owner'::"text")))));



CREATE POLICY "Gestión de marcas autenticados" ON "public"."brands" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Gestión de materiales autenticados" ON "public"."materials" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Gestión reservas autenticados" ON "public"."stock_reservations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Lectura pública de configuraciones" ON "public"."store_settings" FOR SELECT USING (true);



CREATE POLICY "Lectura pública de guías de medidas" ON "public"."size_guides" FOR SELECT USING (true);



CREATE POLICY "Lectura pública de marcas activas" ON "public"."brands" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Lectura pública de materiales activos" ON "public"."materials" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Lectura pública reservas" ON "public"."stock_reservations" FOR SELECT USING (true);



CREATE POLICY "Los usuarios pueden actualizar su propio perfil" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Los usuarios pueden ver su propio perfil" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Permitir a administradores actualizar perfiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND (("profiles_1"."role")::"text" = 'owner'::"text")))) OR ("auth"."uid"() = "id"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND (("profiles_1"."role")::"text" = 'owner'::"text")))) OR ("auth"."uid"() = "id")));



CREATE POLICY "Permitir a administradores crear perfiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND (("profiles_1"."role")::"text" = 'owner'::"text")))) OR ("auth"."uid"() = "id")));



CREATE POLICY "Permitir crear ordenes a invitados y usuarios" ON "public"."orders" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Permitir gestion completa a administradores" ON "public"."product_color_images" USING (true) WITH CHECK (true);



CREATE POLICY "Permitir insercion cache identidades" ON "public"."identity_cache" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Permitir insertar items de orden" ON "public"."order_items" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Permitir lectura cache identidades" ON "public"."identity_cache" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Permitir lectura publica de fotos por color" ON "public"."product_color_images" FOR SELECT USING (true);



CREATE POLICY "Permitir lectura publica de ordenes" ON "public"."orders" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Permitir lectura publica de order_items" ON "public"."order_items" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "addresses_delete_own" ON "public"."addresses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "addresses_insert_own" ON "public"."addresses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "addresses_select_policy" ON "public"."addresses" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_owner"() OR ("public"."is_delivery"() AND ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."shipping_address_id" = "addresses"."id") AND ("orders"."assigned_delivery_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."shipping_address_id" = "addresses"."id") AND ("orders"."assigned_delivery_id" IS NULL) AND (("orders"."status")::"text" = ANY ((ARRAY['por_asignar_repartidor'::character varying, 'en_preparacion'::character varying, 'preparando'::character varying])::"text"[])))))))));



CREATE POLICY "addresses_update_own" ON "public"."addresses" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cart_items_anon_select" ON "public"."cart_items" FOR SELECT TO "anon" USING (("user_id" IS NULL));



CREATE POLICY "cart_items_delete_own" ON "public"."cart_items" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cart_items_insert_own" ON "public"."cart_items" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "cart_items_select_own" ON "public"."cart_items" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cart_items_update_own" ON "public"."cart_items" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_all_owner" ON "public"."categories" USING ("public"."is_owner"());



CREATE POLICY "categories_select_public" ON "public"."categories" FOR SELECT USING (true);



ALTER TABLE "public"."delivery_zones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delivery_zones_all_owner" ON "public"."delivery_zones" USING ("public"."is_owner"());



CREATE POLICY "delivery_zones_select_public" ON "public"."delivery_zones" FOR SELECT USING (true);



ALTER TABLE "public"."identity_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materials_all_owner" ON "public"."materials" USING ("public"."is_owner"());



CREATE POLICY "materials_select_public" ON "public"."materials" FOR SELECT USING (true);



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_insert_customer" ON "public"."order_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."customer_id" = "auth"."uid"())))));



CREATE POLICY "order_items_select_policy" ON "public"."order_items" FOR SELECT USING (("public"."is_owner"() OR (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND (("orders"."customer_id" = "auth"."uid"()) OR ("orders"."assigned_delivery_id" = "auth"."uid"()) OR ("public"."is_delivery"() AND ("orders"."assigned_delivery_id" IS NULL))))))));



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_insert_customer" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "orders_select_policy" ON "public"."orders" FOR SELECT TO "authenticated", "anon" USING (("public"."is_owner"() OR ("auth"."uid"() = "customer_id") OR ("auth"."uid"() = "assigned_delivery_id") OR ("public"."is_delivery"() AND ("assigned_delivery_id" IS NULL) AND (("status")::"text" = ANY ((ARRAY['por_asignar_repartidor'::character varying, 'en_preparacion'::character varying, 'preparando'::character varying])::"text"[])))));



CREATE POLICY "orders_update_policy" ON "public"."orders" FOR UPDATE TO "authenticated" USING (("public"."is_owner"() OR ("public"."is_delivery"() AND (("assigned_delivery_id" IS NULL) OR ("assigned_delivery_id" = "auth"."uid"()))))) WITH CHECK (("public"."is_owner"() OR ("public"."is_delivery"() AND (("assigned_delivery_id" = "auth"."uid"()) OR ("assigned_delivery_id" IS NULL)))));



ALTER TABLE "public"."product_color_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_variants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_variants_all_owner" ON "public"."product_variants" USING ("public"."is_owner"());



CREATE POLICY "product_variants_select_public" ON "public"."product_variants" FOR SELECT USING ((("is_active" = true) OR "public"."is_owner"()));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_all_owner" ON "public"."products" USING ("public"."is_owner"());



CREATE POLICY "products_select_public" ON "public"."products" FOR SELECT USING ((("is_active" = true) OR "public"."is_owner"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own_or_staff" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."is_owner"() OR "public"."is_delivery"()));



CREATE POLICY "profiles_update_own_or_owner" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "id") OR "public"."is_owner"()));



ALTER TABLE "public"."size_guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sizes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sizes_all_owner" ON "public"."sizes" USING ("public"."is_owner"());



CREATE POLICY "sizes_select_public" ON "public"."sizes" FOR SELECT USING (true);



ALTER TABLE "public"."stock_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_variant_stock"("p_variant_id" bigint, "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_variant_stock"("p_variant_id" bigint, "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_variant_stock"("p_variant_id" bigint, "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_delivery"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."release_checkout_stock"("p_reservation_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_checkout_stock"("p_reservation_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_checkout_stock"("p_reservation_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_checkout_stock"("p_items" "jsonb", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_checkout_stock"("p_items" "jsonb", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_checkout_stock"("p_items" "jsonb", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_checkout_preflight"("p_reservation_token" "uuid", "p_delivery_type" "text", "p_total_items" integer, "p_scheduled_time_slot" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_checkout_preflight"("p_reservation_token" "uuid", "p_delivery_type" "text", "p_total_items" integer, "p_scheduled_time_slot" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_checkout_preflight"("p_reservation_token" "uuid", "p_delivery_type" "text", "p_total_items" integer, "p_scheduled_time_slot" "text") TO "service_role";



GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."addresses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."addresses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."addresses_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brands_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brands_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brands_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_zones" TO "anon";
GRANT ALL ON TABLE "public"."delivery_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_zones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."delivery_zones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."delivery_zones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."delivery_zones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."identity_cache" TO "anon";
GRANT ALL ON TABLE "public"."identity_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."identity_cache" TO "service_role";



GRANT ALL ON SEQUENCE "public"."identity_cache_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."identity_cache_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."identity_cache_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON SEQUENCE "public"."materials_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."materials_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."materials_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."product_color_images" TO "anon";
GRANT ALL ON TABLE "public"."product_color_images" TO "authenticated";
GRANT ALL ON TABLE "public"."product_color_images" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_color_images_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_color_images_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_color_images_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_variants" TO "anon";
GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."size_guides" TO "anon";
GRANT ALL ON TABLE "public"."size_guides" TO "authenticated";
GRANT ALL ON TABLE "public"."size_guides" TO "service_role";



GRANT ALL ON SEQUENCE "public"."size_guides_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."size_guides_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."size_guides_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sizes" TO "anon";
GRANT ALL ON TABLE "public"."sizes" TO "authenticated";
GRANT ALL ON TABLE "public"."sizes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sizes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sizes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sizes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stock_reservations" TO "anon";
GRANT ALL ON TABLE "public"."stock_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."store_settings" TO "anon";
GRANT ALL ON TABLE "public"."store_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."store_settings" TO "service_role";



GRANT ALL ON TABLE "public"."v_product_variants_available" TO "anon";
GRANT ALL ON TABLE "public"."v_product_variants_available" TO "authenticated";
GRANT ALL ON TABLE "public"."v_product_variants_available" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







