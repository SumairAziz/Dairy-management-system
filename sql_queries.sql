-- Add users table if not exists
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'VIEWER',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP(6) DEFAULT NOW(),
  updated_at TIMESTAMP(6) DEFAULT NOW()
);

-- Add audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  entity VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP(6) DEFAULT NOW()
);

-- Add notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  created_at TIMESTAMP(6) DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_animals_farm_id ON animals(farm_id);
CREATE INDEX IF NOT EXISTS idx_animals_breed_id ON animals(breed_id);
CREATE INDEX IF NOT EXISTS idx_animals_tag_number ON animals(tag_number);
CREATE INDEX IF NOT EXISTS idx_animals_lifecycle ON animals(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_animals_is_active ON animals(is_active);
CREATE INDEX IF NOT EXISTS idx_milk_logs_animal_id ON milk_logs(animal_id);
CREATE INDEX IF NOT EXISTS idx_milk_logs_production_date ON milk_logs(production_date);
CREATE INDEX IF NOT EXISTS idx_growth_logs_animal_id ON growth_logs(animal_id);
CREATE INDEX IF NOT EXISTS idx_growth_logs_recorded_date ON growth_logs(recorded_date);
CREATE INDEX IF NOT EXISTS idx_health_incidents_animal_id ON health_incidents(animal_id);
CREATE INDEX IF NOT EXISTS idx_health_incidents_status ON health_incidents(status);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_animal_id ON vaccination_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_vaccination_records_next_due ON vaccination_records(next_due_date);
CREATE INDEX IF NOT EXISTS idx_heat_cycle_records_animal_id ON heat_cycle_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_pregnancy_records_animal_id ON pregnancy_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_pregnancy_records_status ON pregnancy_records(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);