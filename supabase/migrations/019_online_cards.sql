-- Online Card Packets (independent from the QR-card subscription system)
CREATE TABLE online_packets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cards within a packet — each has a 9/16 question image + YouTube correction URL
CREATE TABLE online_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id   UUID NOT NULL REFERENCES online_packets(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  image_url   TEXT,
  youtube_url TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student → Packet subscriptions
CREATE TABLE online_packet_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  packet_id  UUID NOT NULL REFERENCES online_packets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, packet_id)
);

ALTER TABLE online_packets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_cards               ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_packet_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage online_packets" ON online_packets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'));

CREATE POLICY "Admins manage online_cards" ON online_cards FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'));

CREATE POLICY "Admins manage subscriptions" ON online_packet_subscriptions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin'));

-- Students can read their own subscriptions and the packets/cards they are subscribed to
CREATE POLICY "Students read own subscriptions" ON online_packet_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Students read subscribed packets" ON online_packets FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM online_packet_subscriptions ops
    WHERE ops.packet_id = id AND ops.user_id = auth.uid()
  ));

CREATE POLICY "Students read subscribed cards" ON online_cards FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM online_packet_subscriptions ops
    WHERE ops.packet_id = online_cards.packet_id AND ops.user_id = auth.uid()
  ));
