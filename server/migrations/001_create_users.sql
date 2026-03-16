-- server/migrations/001_create_users.sql

CREATE TABLE IF NOT EXISTS `users` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     VARCHAR(32)     NOT NULL COMMENT '全局唯一用户ID',
    `nickname`    VARCHAR(64)     NOT NULL DEFAULT '',
    `avatar`      VARCHAR(256)    NOT NULL DEFAULT '',
    `phone`       VARCHAR(20)     DEFAULT NULL COMMENT '手机号',
    `wx_openid`   VARCHAR(128)    DEFAULT NULL COMMENT '微信小游戏OpenID',
    `wx_unionid`  VARCHAR(128)    DEFAULT NULL COMMENT '微信UnionID',
    `password`    VARCHAR(128)    DEFAULT NULL COMMENT 'bcrypt加密密码',
    `coins`       BIGINT          NOT NULL DEFAULT 2000 COMMENT '金币余额',
    `status`      TINYINT         NOT NULL DEFAULT 1 COMMENT '1=正常 0=封禁',
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_id` (`user_id`),
    UNIQUE KEY `uk_phone` (`phone`),
    UNIQUE KEY `uk_wx_openid` (`wx_openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
