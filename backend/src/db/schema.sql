-- on-your-left database schema

CREATE TABLE IF NOT EXISTS routes (
  id          VARCHAR(50) PRIMARY KEY,
  name        TEXT        NOT NULL,
  short_name  TEXT        NOT NULL,
  description TEXT,
  location    TEXT,
  center_lng  DOUBLE PRECISION NOT NULL,
  center_lat  DOUBLE PRECISION NOT NULL,
  zoom        SMALLINT    NOT NULL DEFAULT 14,
  color       VARCHAR(20) NOT NULL DEFAULT '#6366f1',
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crowd_reports (
  id          SERIAL PRIMARY KEY,
  route_id    VARCHAR(50) NOT NULL,
  status      VARCHAR(10) NOT NULL CHECK (status IN ('empty', 'moderate', 'packed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crowd_reports_route_created
  ON crowd_reports (route_id, created_at DESC);

CREATE TABLE IF NOT EXISTS typical_crowds (
  route_id     VARCHAR(50)  NOT NULL,
  day_of_week  SMALLINT     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  hour_of_day  SMALLINT     NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  status       VARCHAR(10)  NOT NULL CHECK (status IN ('empty', 'moderate', 'packed')),
  PRIMARY KEY (route_id, day_of_week, hour_of_day)
);
