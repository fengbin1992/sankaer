package match

import (
	"crypto/rand"
	"fmt"
	"time"

	"go.uber.org/zap"
)

const (
	matchPlayers  = 5
	matchInterval = 1 * time.Second // 匹配检查间隔
)

// Matcher 匹配器
type Matcher struct {
	tiers       []uint32
	onMatched   func(roomID string, tier uint32, playerIDs []string) // 匹配成功回调
	stopCh      chan struct{}
}

// NewMatcher 创建匹配器
func NewMatcher(onMatched func(string, uint32, []string)) *Matcher {
	return &Matcher{
		tiers:     []uint32{10, 100, 1000, 10000},
		onMatched: onMatched,
		stopCh:    make(chan struct{}),
	}
}

// Start 启动匹配循环
func (m *Matcher) Start() {
	go func() {
		ticker := time.NewTicker(matchInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				m.tryMatch()
			case <-m.stopCh:
				return
			}
		}
	}()
	zap.L().Info("匹配器已启动")
}

// Stop 停止
func (m *Matcher) Stop() {
	close(m.stopCh)
}

// tryMatch 尝试各场次匹配
func (m *Matcher) tryMatch() {
	for _, tier := range m.tiers {
		size, err := QueueSize(tier)
		if err != nil {
			continue
		}
		if size < matchPlayers {
			continue
		}

		// 弹出 5 人
		players, err := PopPlayers(tier, matchPlayers)
		if err != nil || players == nil {
			continue
		}

		// 生成房间 ID
		roomID := generateRoomID()

		zap.L().Info("匹配成功",
			zap.String("roomId", roomID),
			zap.Uint32("tier", tier),
			zap.Strings("players", players),
		)

		// 清除匹配数据
		for _, pid := range players {
			RemovePlayerData(pid)
		}

		// 回调
		if m.onMatched != nil {
			m.onMatched(roomID, tier, players)
		}
	}
}

// generateRoomID 生成房间 ID
func generateRoomID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return fmt.Sprintf("R%X", b)
}
