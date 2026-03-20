package gateway

import (
	"sync"
	"time"

	"go.uber.org/zap"
)

const (
	heartbeatInterval = 30 * time.Second
	heartbeatTimeout  = 90 * time.Second
)

// HeartbeatManager 心跳管理
type HeartbeatManager struct {
	mu        sync.RWMutex
	lastPing  map[string]time.Time // userId → 最后收到心跳的时间
	connMgr   *ConnManager
	stopCh    chan struct{}
}

// NewHeartbeatManager 创建心跳管理器
func NewHeartbeatManager(connMgr *ConnManager) *HeartbeatManager {
	return &HeartbeatManager{
		lastPing: make(map[string]time.Time),
		connMgr:  connMgr,
		stopCh:   make(chan struct{}),
	}
}

// RecordPing 记录心跳
func (h *HeartbeatManager) RecordPing(userID string) {
	h.mu.Lock()
	h.lastPing[userID] = time.Now()
	h.mu.Unlock()
}

// Remove 移除记录
func (h *HeartbeatManager) Remove(userID string) {
	h.mu.Lock()
	delete(h.lastPing, userID)
	h.mu.Unlock()
}

// Start 启动心跳检测协程
func (h *HeartbeatManager) Start() {
	go func() {
		ticker := time.NewTicker(heartbeatInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				h.checkTimeout()
			case <-h.stopCh:
				return
			}
		}
	}()
}

// Stop 停止
func (h *HeartbeatManager) Stop() {
	close(h.stopCh)
}

// checkTimeout 检查超时连接
func (h *HeartbeatManager) checkTimeout() {
	h.mu.RLock()
	now := time.Now()
	var expired []string
	for uid, last := range h.lastPing {
		if now.Sub(last) > heartbeatTimeout {
			expired = append(expired, uid)
		}
	}
	h.mu.RUnlock()

	for _, uid := range expired {
		zap.L().Info("心跳超时，断开连接", zap.String("userId", uid))
		if conn := h.connMgr.Get(uid); conn != nil {
			conn.Close()
		}
		h.Remove(uid)
		h.connMgr.Remove(uid)
	}
}
