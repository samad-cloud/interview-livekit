-- Create locations table for country/city/currency management
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  city TEXT,
  currency_code TEXT NOT NULL,
  currency_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on country+city combination
CREATE UNIQUE INDEX IF NOT EXISTS locations_country_city_idx
  ON locations (country, COALESCE(city, ''));

-- Seed default locations
INSERT INTO locations (country, city, currency_code, currency_name) VALUES
  ('UAE', 'Dubai', 'AED', 'UAE Dirham'),
  ('United Kingdom', 'London', 'GBP', 'British Pound'),
  ('Malaysia', 'Kuala Lumpur', 'MYR', 'Malaysian Ringgit'),
  ('Singapore', 'Singapore', 'SGD', 'Singapore Dollar'),
  ('Vietnam', 'Ho Chi Minh City', 'VND', 'Vietnamese Dong'),
  ('Vietnam', 'Hanoi', 'VND', 'Vietnamese Dong'),
  ('India', 'Mumbai', 'INR', 'Indian Rupee'),
  ('India', 'Bangalore', 'INR', 'Indian Rupee'),
  ('India', 'New Delhi', 'INR', 'Indian Rupee'),
  ('United States', NULL, 'USD', 'US Dollar'),
  ('European Union', NULL, 'EUR', 'Euro')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read locations
CREATE POLICY "Anyone can read locations" ON locations
  FOR SELECT USING (true);

-- Allow authenticated users to insert locations
CREATE POLICY "Authenticated users can insert locations" ON locations
  FOR INSERT WITH CHECK (true);
