{{ config(
    materialized='view'
) }}

WITH raw_events AS (
    SELECT
        id AS event_id,
        event_type,
        ts AS event_timestamp,
        session_id,
        guest_id,
        data,
        ip_data,
        received_at,
        -- Extract common fields from data JSON
        data->>'path' AS page_path,
        data->>'referrer' AS referrer,
        (data->>'ms_on_page')::INTEGER AS ms_on_page,
        data->>'query_redacted' AS search_query,
        (data->>'results_count')::INTEGER AS search_results_count,
        (data->>'zero_result')::BOOLEAN AS is_zero_result,
        data->>'faq_id' AS faq_id,
        (data->>'dwell_ms')::INTEGER AS dwell_ms,
        data->>'category' AS service_category,
        data->>'subcategory' AS service_subcategory,
        data->>'selection_type' AS selection_type,
        data->>'selection_value' AS selection_value,
        -- Extract IP geo data
        ip_data->>'geo_country' AS geo_country,
        ip_data->>'geo_region' AS geo_region,
        ip_data->>'geo_city' AS geo_city,
        ip_data->>'ip_trunc' AS ip_trunc,
        ip_data->>'ip_hash' AS ip_hash
    FROM {{ source('raw', 'events') }}
    WHERE received_at >= CURRENT_DATE - INTERVAL '{{ var("event_retention_days") }} days'
)

SELECT
    event_id,
    event_type,
    event_timestamp,
    session_id,
    guest_id,
    page_path,
    referrer,
    ms_on_page,
    search_query,
    search_results_count,
    is_zero_result,
    faq_id,
    dwell_ms,
    service_category,
    service_subcategory,
    selection_type,
    selection_value,
    geo_country,
    geo_region,
    geo_city,
    ip_trunc,
    ip_hash,
    received_at,
    -- Add processing timestamp
    CURRENT_TIMESTAMP AS processed_at
FROM raw_events