-- server/migrations/002_create_game_records.sql

CREATE TABLE IF NOT EXISTS `game_records` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_id`         VARCHAR(32)     NOT NULL COMMENT '房间ID',
    `bid_score`       INT             NOT NULL COMMENT '叫分值 75/80/85/90/95/100',
    `trump_suit`      TINYINT         NOT NULL COMMENT '主花色 1=黑桃 2=红心 3=方块 4=梅花',
    `dealer_id`       VARCHAR(32)     NOT NULL COMMENT '庄家ID',
    `partner_id`      VARCHAR(32)     DEFAULT NULL COMMENT '搭档ID',
    `is_solo`         TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否1打4',
    `catcher_score`   INT             NOT NULL DEFAULT 0 COMMENT '抓分方得分',
    `bottom_points`   INT             NOT NULL DEFAULT 0 COMMENT '底牌分值',
    `is_zero_clear`   TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '清零双倍',
    `is_last_bonus`   TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '关底双倍',
    `winner`          VARCHAR(16)     NOT NULL COMMENT 'dealer/catcher/forfeit',
    `tier`            INT             NOT NULL COMMENT '场次倍率 10/100/1000/10000',
    `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_room_id` (`room_id`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对局记录表';

CREATE TABLE IF NOT EXISTS `game_settlements` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `record_id`   BIGINT UNSIGNED NOT NULL COMMENT '关联game_records.id',
    `user_id`     VARCHAR(32)     NOT NULL,
    `role`        VARCHAR(16)     NOT NULL COMMENT 'dealer/partner/catcher',
    `multiplier`  INT             NOT NULL COMMENT '角色倍数 1/2/4',
    `amount`      BIGINT          NOT NULL COMMENT '赢/输金币数',
    `coins_after` BIGINT          NOT NULL COMMENT '结算后余额',
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_record_id` (`record_id`),
    KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对局结算明细表';
