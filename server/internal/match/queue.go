package match

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	pkgRedis "sankaer/internal/pkg/redis"
)

var ctx = context.Background()

// QueueKey 匹配队列 Redis key
func QueueKey(tier uint32) string {
	return fmt.Sprintf("match:queue:%d", tier)
}

// PlayerDataKey 匹配中玩家数据
func PlayerDataKey(userID string) string {
	return fmt.Sprintf("match:player:%s", userID)
}

// JoinQueue 加入匹配队列
func JoinQueue(tier uint32, userID string) error {
	key := QueueKey(tier)
	score := float64(time.Now().UnixMilli()) // 按加入时间排序
	return pkgRedis.Client.ZAdd(ctx, key, redis.Z{
		Score:  score,
		Member: userID,
	}).Err()
}

// LeaveQueue 离开匹配队列
func LeaveQueue(tier uint32, userID string) error {
	key := QueueKey(tier)
	return pkgRedis.Client.ZRem(ctx, key, userID).Err()
}

// QueueSize 队列人数
func QueueSize(tier uint32) (int64, error) {
	key := QueueKey(tier)
	return pkgRedis.Client.ZCard(ctx, key).Result()
}

// PopPlayers 从队列弹出 N 个玩家（按等待时间最久优先）
func PopPlayers(tier uint32, count int) ([]string, error) {
	key := QueueKey(tier)

	// 获取最早加入的 count 个玩家
	members, err := pkgRedis.Client.ZRange(ctx, key, 0, int64(count-1)).Result()
	if err != nil {
		return nil, err
	}
	if len(members) < count {
		return nil, nil // 人数不足
	}

	// 从队列移除
	for _, m := range members {
		pkgRedis.Client.ZRem(ctx, key, m)
	}

	return members, nil
}

// IsInQueue 检查玩家是否在队列中
func IsInQueue(tier uint32, userID string) (bool, error) {
	key := QueueKey(tier)
	_, err := pkgRedis.Client.ZScore(ctx, key, userID).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// GetWaitingInfo 获取等待信息
func GetWaitingInfo(tier uint32, userID string) (queueSize int64, elapsedSec uint32, err error) {
	queueSize, err = QueueSize(tier)
	if err != nil {
		return
	}

	key := QueueKey(tier)
	score, err := pkgRedis.Client.ZScore(ctx, key, userID).Result()
	if err != nil {
		return queueSize, 0, nil
	}
	joinTime := time.UnixMilli(int64(score))
	elapsedSec = uint32(time.Since(joinTime).Seconds())
	return
}

// ClearPlayerTier 清除玩家的场次记录
func SetPlayerTier(userID string, tier uint32) error {
	return pkgRedis.Client.Set(ctx, PlayerDataKey(userID), fmt.Sprintf("%d", tier), 10*time.Minute).Err()
}

// GetPlayerTier 获取玩家匹配的场次
func GetPlayerTier(userID string) (uint32, error) {
	val, err := pkgRedis.Client.Get(ctx, PlayerDataKey(userID)).Result()
	if err != nil {
		return 0, err
	}
	var tier uint32
	fmt.Sscanf(val, "%d", &tier)
	return tier, nil
}

// RemovePlayerData 清除玩家匹配数据
func RemovePlayerData(userID string) {
	pkgRedis.Client.Del(ctx, PlayerDataKey(userID))
	// 尝试从所有场次移除
	for _, tier := range []uint32{10, 100, 1000, 10000} {
		LeaveQueue(tier, userID)
	}
	zap.L().Debug("清除玩家匹配数据", zap.String("userId", userID))
}
