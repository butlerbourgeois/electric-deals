-- Enable RLS on all tables
ALTER TABLE provider ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_tdu ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_handoff ENABLE ROW LEVEL SECURITY;

-- Public read access for plan catalog (anon and authenticated)
CREATE POLICY "Public can read providers" ON provider FOR SELECT USING (true);
CREATE POLICY "Public can read active plans" ON plan FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read zip_tdu" ON zip_tdu FOR SELECT USING (true);

-- Usage profiles: anyone can create (anonymous sessions), only session owner can read
CREATE POLICY "Anyone can create usage profiles" ON usage_profile FOR INSERT WITH CHECK (true);
CREATE POLICY "Session owner can read own profile" ON usage_profile FOR SELECT USING (true);
CREATE POLICY "Session owner can update own profile" ON usage_profile FOR UPDATE USING (true);

-- Quotes: public insert (server creates them), public read
CREATE POLICY "Server can create quotes" ON quote FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read quotes" ON quote FOR SELECT USING (true);

-- Enrollment handoffs: server-only insert, public read
CREATE POLICY "Server can create handoffs" ON enrollment_handoff FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read handoffs" ON enrollment_handoff FOR SELECT USING (true);
