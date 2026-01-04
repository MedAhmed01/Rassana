-- Migration: Add device binding for single device per student
-- Each student can only access from one device at a time
-- Admin can activate/deactivate device binding per student

ALTER TABLE user_profiles 
ADD COLUMN device_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN device_bound_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN device_binding_enabled BOOLEAN DEFAULT FALSE;

-- Index for fast device lookups
CREATE INDEX idx_user_profiles_device_id ON user_profiles(device_id);

-- Comments explaining the columns
COMMENT ON COLUMN user_profiles.device_id IS 'Unique device identifier bound to this student. Only this device can access the account.';
COMMENT ON COLUMN user_profiles.device_bound_at IS 'Timestamp when the device was bound to this account.';
COMMENT ON COLUMN user_profiles.device_binding_enabled IS 'Whether device binding is enabled for this student. When enabled, student can only login from one device.';
