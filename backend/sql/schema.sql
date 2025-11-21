CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    type ENUM('asset', 'liability') NOT NULL,
    category VARCHAR(80) NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
    note TEXT NULL,
    next_due_date DATE NULL,
    household_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT ck_amount_non_negative CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



