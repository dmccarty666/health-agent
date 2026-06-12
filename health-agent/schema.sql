-- Health Agent — PostgreSQL Schema
-- Adapted from Blue2Scale schema

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
  name                VARCHAR(255)  NOT NULL DEFAULT '',
  email               VARCHAR(255)  NOT NULL,
  image               TEXT,
  sex                 VARCHAR(8)    DEFAULT 'male',
  age                 SMALLINT DEFAULT 30,
  height_cm           DECIMAL(5,1)  DEFAULT 175.0,
  activity_level      VARCHAR(10)   DEFAULT 'moderate',
  muscle_calibration  DECIMAL(4,2)  DEFAULT 1.00,
  unit_preference     VARCHAR(8)    DEFAULT 'metric',
  theme               VARCHAR(8)    DEFAULT 'system',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Body composition measurements
CREATE TABLE IF NOT EXISTS measurements (
  id                        VARCHAR(36)     NOT NULL PRIMARY KEY,
  user_id                   VARCHAR(36)     NOT NULL,
  measured_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  device_name               VARCHAR(255),
  note                      TEXT,
  raw_ble_data              JSONB,

  -- Core
  weight_kg                 DECIMAL(6,3),
  bmi                       DECIMAL(5,2),

  -- Body fat
  body_fat_pct              DECIMAL(5,2),
  fat_mass_kg               DECIMAL(6,3),
  subcut_fat_kg             DECIMAL(6,3),
  subcut_fat_pct            DECIMAL(5,2),
  visceral_fat              DECIMAL(5,1),
  android_fat_kg            DECIMAL(6,3),
  gynoid_fat_kg             DECIMAL(6,3),
  ag_ratio_pct              DECIMAL(5,2),

  -- Lean & muscle
  lean_mass_kg              DECIMAL(6,3),
  lean_mass_pct             DECIMAL(5,2),
  skel_muscle_kg            DECIMAL(6,3),
  body_cell_mass_kg         DECIMAL(6,3),

  -- Water
  body_water_pct            DECIMAL(5,2),
  total_water_kg            DECIMAL(6,3),
  ecw_kg                    DECIMAL(6,3),
  icw_kg                    DECIMAL(6,3),

  -- Bone & mineral
  bone_mineral_kg           DECIMAL(6,3),
  mineral_mass_kg           DECIMAL(6,3),

  -- Other composition
  skeletal_mass_kg          DECIMAL(6,3),
  organ_mass_kg             DECIMAL(6,3),

  -- Metabolic
  bmr_kcal                  DECIMAL(7,1),
  metabolic_age             SMALLINT,

  -- Segmental — right arm
  seg_right_arm_muscle_kg   DECIMAL(5,3),
  seg_right_arm_fat_pct     DECIMAL(5,2),
  seg_right_arm_fat_kg      DECIMAL(5,3),

  -- Segmental — left arm
  seg_left_arm_muscle_kg    DECIMAL(5,3),
  seg_left_arm_fat_pct      DECIMAL(5,2),
  seg_left_arm_fat_kg       DECIMAL(5,3),

  -- Segmental — trunk
  seg_trunk_muscle_kg       DECIMAL(6,3),
  seg_trunk_fat_pct         DECIMAL(5,2),
  seg_trunk_fat_kg          DECIMAL(6,3),

  -- Segmental — right leg
  seg_right_leg_muscle_kg   DECIMAL(5,3),
  seg_right_leg_fat_pct     DECIMAL(5,2),
  seg_right_leg_fat_kg      DECIMAL(5,3),

  -- Segmental — left leg
  seg_left_leg_muscle_kg    DECIMAL(5,3),
  seg_left_leg_fat_pct      DECIMAL(5,2),
  seg_left_leg_fat_kg       DECIMAL(5,3),

  CONSTRAINT fk_measurements_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Prevent duplicate ingest for the same user+timestamp (required by ON CONFLICT in db.py)
ALTER TABLE measurements ADD CONSTRAINT uq_measurements_user_ts UNIQUE (user_id, measured_at);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id            VARCHAR(36)     NOT NULL PRIMARY KEY,
  user_id       VARCHAR(36)     NOT NULL,
  metric_key    VARCHAR(100)    NOT NULL,
  target_value  DECIMAL(10,4)   NOT NULL,
  target_date   DATE,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Device compatibility reports
CREATE TABLE IF NOT EXISTS device_reports (
  id            VARCHAR(36)     NOT NULL PRIMARY KEY,
  user_id       VARCHAR(36),
  device_name   VARCHAR(255)    NOT NULL,
  device_brand  VARCHAR(255),
  works         BOOLEAN         NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_measurements_user_date ON measurements (user_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);

-- Insert default user
INSERT INTO users (id, name, email, sex, height_cm, unit_preference)
VALUES ('david-mccarty', 'David McCarty', 'david@mccarty-online.com', 'male', 183.0, 'metric')
ON CONFLICT (id) DO NOTHING;
