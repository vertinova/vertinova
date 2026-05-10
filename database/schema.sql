CREATE DATABASE IF NOT EXISTS vertinova_finance
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vertinova_finance;

CREATE TABLE IF NOT EXISTS revenue_sources (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category ENUM('api', 'manual') NOT NULL,
  current_balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
  status ENUM('sinkron', 'api_belum_terhubung', 'manual') NOT NULL DEFAULT 'manual',
  color VARCHAR(16) NOT NULL,
  description VARCHAR(255) NOT NULL,
  last_synced_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  source_id VARCHAR(32) NOT NULL,
  external_id VARCHAR(120) NULL,
  direction ENUM('income', 'expense') NOT NULL DEFAULT 'income',
  amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
  description VARCHAR(255) NOT NULL,
  status ENUM('terverifikasi', 'review', 'terjadwal') NOT NULL DEFAULT 'review',
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_source_external_id (source_id, external_id),
  KEY index_source_occurred_at (source_id, occurred_at),
  CONSTRAINT fk_finance_transactions_source
    FOREIGN KEY (source_id) REFERENCES revenue_sources(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS api_sync_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  source_id VARCHAR(32) NOT NULL,
  status ENUM('success', 'failed') NOT NULL,
  message VARCHAR(255) NOT NULL,
  response_payload JSON NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY index_source_synced_at (source_id, synced_at),
  CONSTRAINT fk_api_sync_logs_source
    FOREIGN KEY (source_id) REFERENCES revenue_sources(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin') NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY index_user_expires_at (user_id, expires_at),
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

INSERT INTO revenue_sources (id, name, category, current_balance, status, color, description)
VALUES
  ('simpaskor', 'Simpaskor', 'api', 0, 'api_belum_terhubung', '#23c483', 'Saldo masuk otomatis dari API Simpaskor.'),
  ('forbasi', 'Forbasi', 'api', 0, 'api_belum_terhubung', '#3b82f6', 'Saldo masuk otomatis dari API Forbasi.'),
  ('desa', 'Desa', 'manual', 0, 'manual', '#f59e0b', 'Pendapatan desa belum diisi manual.'),
  ('sekolah', 'Sekolah', 'manual', 0, 'manual', '#ef5da8', 'Pendapatan sekolah belum diisi manual.'),
  ('swasta', 'Swasta', 'manual', 0, 'manual', '#8b5cf6', 'Pendapatan swasta belum diisi manual.')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  color = VALUES(color),
  description = VALUES(description);
