-- Migration: Add billing and subscription support
-- This enables monetization through subscription plans

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  max_players INT UNSIGNED DEFAULT NULL, -- NULL = unlimited
  max_tournaments_per_year INT UNSIGNED DEFAULT NULL, -- NULL = unlimited
  features JSON, -- Store feature flags as JSON
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing entity subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  billing_entity_id INT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'trial', 'active', 'past_due', 'canceled', 'expired'
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  trial_ends_at DATE DEFAULT NULL,
  stripe_subscription_id VARCHAR(255) DEFAULT NULL,
  stripe_customer_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (billing_entity_id) REFERENCES billing_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  INDEX idx_billing_entity_id (billing_entity_id),
  INDEX idx_status (status),
  INDEX idx_period_end (current_period_end),
  INDEX idx_stripe_subscription (stripe_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment history
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL, -- 'pending', 'succeeded', 'failed', 'refunded'
  stripe_payment_intent_id VARCHAR(255) DEFAULT NULL,
  stripe_charge_id VARCHAR(255) DEFAULT NULL,
  paid_at TIMESTAMP NULL,
  refunded_at TIMESTAMP NULL,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_status (status),
  INDEX idx_paid_at (paid_at),
  INDEX idx_stripe_payment_intent (stripe_payment_intent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT UNSIGNED NOT NULL,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL, -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMP NULL,
  stripe_invoice_id VARCHAR(255) DEFAULT NULL,
  pdf_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_stripe_invoice (stripe_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default free plan
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_players, max_tournaments_per_year, features) VALUES
('Free', 'free', 'Perfect for small groups getting started', 0.00, 0.00, 20, 12, JSON_OBJECT(
  'max_leagues', 1,
  'max_events', 2,
  'tournaments', true,
  'scores', true,
  'leaderboard', true,
  'email_notifications', false,
  'sms_notifications', false,
  'custom_branding', false,
  'api_access', false
)),
('Standard', 'standard', 'Great for active leagues', 29.99, 299.99, 100, NULL, JSON_OBJECT(
  'max_leagues', 3,
  'max_events', 10,
  'tournaments', true,
  'scores', true,
  'leaderboard', true,
  'email_notifications', true,
  'sms_notifications', false,
  'custom_branding', false,
  'api_access', false,
  'priority_support', true
)),
('Premium', 'premium', 'Full-featured for serious organizations', 79.99, 799.99, NULL, NULL, JSON_OBJECT(
  'max_leagues', NULL,
  'max_events', NULL,
  'tournaments', true,
  'scores', true,
  'leaderboard', true,
  'email_notifications', true,
  'sms_notifications', true,
  'custom_branding', true,
  'api_access', true,
  'priority_support', true,
  'dedicated_account_manager', true,
  'white_label', true
));

-- Create free subscription for existing billing entity
INSERT INTO subscriptions (billing_entity_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
SELECT 
  be.id,
  (SELECT id FROM subscription_plans WHERE slug = 'free'),
  'active',
  'monthly',
  CURDATE(),
  DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
FROM billing_entities be
WHERE be.slug = 'paradise-golf';
