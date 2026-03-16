-- server/migrations/003_create_orders.sql

CREATE TABLE IF NOT EXISTS `coin_orders` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id`       VARCHAR(64)     NOT NULL COMMENT '订单号',
    `user_id`        VARCHAR(32)     NOT NULL,
    `amount`         INT             NOT NULL COMMENT '充值金额（分）',
    `coins`          BIGINT          NOT NULL COMMENT '到账金币数',
    `pay_method`     VARCHAR(32)     NOT NULL COMMENT '支付方式',
    `status`         VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/expired/refunded',
    `transaction_id` VARCHAR(128)    DEFAULT NULL COMMENT '第三方支付流水号',
    `paid_at`        DATETIME        DEFAULT NULL,
    `expired_at`     DATETIME        NOT NULL COMMENT '订单过期时间',
    `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_id` (`order_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='充值订单表';
