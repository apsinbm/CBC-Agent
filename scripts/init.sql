-- CBC Analytics Database Initialization Script

-- Create schemas
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS intermediate;
CREATE SCHEMA IF NOT EXISTS marts;

-- Grant permissions
GRANT ALL ON SCHEMA public TO cbc;
GRANT ALL ON SCHEMA staging TO cbc;
GRANT ALL ON SCHEMA intermediate TO cbc;
GRANT ALL ON SCHEMA marts TO cbc;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Set default permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cbc;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON TABLES TO cbc;
ALTER DEFAULT PRIVILEGES IN SCHEMA intermediate GRANT ALL ON TABLES TO cbc;
ALTER DEFAULT PRIVILEGES IN SCHEMA marts GRANT ALL ON TABLES TO cbc;

-- Create initial indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(event_type, ts);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_guest ON sessions(guest_id);