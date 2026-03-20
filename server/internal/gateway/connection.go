package gateway

import (
	"sync"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// Connection 单个 WebSocket 连接
type Connection struct {
	UserID string
	Conn   *websocket.Conn
	RoomID string // 当前所在房间

	send    chan []byte
	closeCh chan struct{}
	once    sync.Once
}

// NewConnection 创建连接
func NewConnection(userID string, conn *websocket.Conn) *Connection {
	return &Connection{
		UserID:  userID,
		Conn:    conn,
		send:    make(chan []byte, 256),
		closeCh: make(chan struct{}),
	}
}

// Send 发送消息
func (c *Connection) Send(data []byte) {
	select {
	case c.send <- data:
	default:
		zap.L().Warn("发送缓冲区已满，丢弃消息", zap.String("userId", c.UserID))
	}
}

// Close 关闭连接
func (c *Connection) Close() {
	c.once.Do(func() {
		close(c.closeCh)
		c.Conn.Close()
	})
}

// WritePump 写协程：从 send channel 读消息发给客户端
func (c *Connection) WritePump() {
	defer c.Close()
	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				zap.L().Error("写消息失败", zap.String("userId", c.UserID), zap.Error(err))
				return
			}
		case <-c.closeCh:
			return
		}
	}
}

// ConnManager 连接管理器（userId → Connection）
type ConnManager struct {
	mu    sync.RWMutex
	conns map[string]*Connection
}

// NewConnManager 创建连接管理器
func NewConnManager() *ConnManager {
	return &ConnManager{
		conns: make(map[string]*Connection),
	}
}

// Add 添加连接（互踢：同一用户的旧连接会被关闭）
func (m *ConnManager) Add(conn *Connection) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if old, ok := m.conns[conn.UserID]; ok {
		zap.L().Info("互踢旧连接", zap.String("userId", conn.UserID))
		old.Close()
	}
	m.conns[conn.UserID] = conn
}

// Remove 移除连接
func (m *ConnManager) Remove(userID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.conns, userID)
}

// Get 获取连接
func (m *ConnManager) Get(userID string) *Connection {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.conns[userID]
}

// SendTo 向指定用户发送消息
func (m *ConnManager) SendTo(userID string, data []byte) {
	m.mu.RLock()
	conn := m.conns[userID]
	m.mu.RUnlock()

	if conn != nil {
		conn.Send(data)
	}
}

// Broadcast 向多个用户广播
func (m *ConnManager) Broadcast(userIDs []string, data []byte) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, uid := range userIDs {
		if conn, ok := m.conns[uid]; ok {
			conn.Send(data)
		}
	}
}

// UpdateUserID 更新连接的用户 ID（登录后从临时 ID 切换到真实 ID）
func (m *ConnManager) UpdateUserID(oldID, newID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conn, ok := m.conns[oldID]
	if !ok {
		return
	}
	delete(m.conns, oldID)
	conn.UserID = newID
	// 如果新 ID 已有旧连接，互踢
	if old, exists := m.conns[newID]; exists {
		old.Close()
	}
	m.conns[newID] = conn
	zap.L().Info("连接 userId 已更新", zap.String("old", oldID), zap.String("new", newID))
}

// Count 在线连接数
func (m *ConnManager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.conns)
}
