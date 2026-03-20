package gateway

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"sankaer/internal/pkg/config"
)

// Server WebSocket 网关服务器
type Server struct {
	cfg          *config.AppConfig
	connMgr      *ConnManager
	heartbeatMgr *HeartbeatManager
	router       *Router
	upgrader     websocket.Upgrader
}

// NewServer 创建网关服务器
func NewServer(cfg *config.AppConfig) *Server {
	connMgr := NewConnManager()
	hbMgr := NewHeartbeatManager(connMgr)
	router := NewRouter(connMgr, hbMgr)

	return &Server{
		cfg:          cfg,
		connMgr:      connMgr,
		heartbeatMgr: hbMgr,
		router:       router,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // MVP 阶段允许所有来源
			},
		},
	}
}

// Start 启动 WebSocket 服务器
func (s *Server) Start() error {
	// 订阅 NATS S2C 消息
	if err := s.router.SubscribeS2C(); err != nil {
		return fmt.Errorf("订阅 S2C 消息失败: %w", err)
	}

	// 启动心跳检测
	s.heartbeatMgr.Start()

	// HTTP 路由
	http.HandleFunc("/ws", s.handleWebSocket)
	http.HandleFunc("/health", s.handleHealth)

	addr := fmt.Sprintf(":%d", s.cfg.Server.Port)
	zap.L().Info("WebSocket 网关启动", zap.String("addr", addr))
	return http.ListenAndServe(addr, nil)
}

// Stop 停止服务器
func (s *Server) Stop() {
	s.heartbeatMgr.Stop()
}

// handleHealth 健康检查
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","connections":%d}`, s.connMgr.Count())
}

// handleWebSocket 处理 WebSocket 连接
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// 从 query 中获取 token
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	// 校验 JWT
	userID, err := s.validateToken(token)
	if err != nil {
		zap.L().Warn("JWT 校验失败", zap.Error(err))
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	// 升级为 WebSocket
	wsConn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		zap.L().Error("WebSocket 升级失败", zap.Error(err))
		return
	}

	conn := NewConnection(userID, wsConn)
	s.connMgr.Add(conn)
	s.heartbeatMgr.RecordPing(userID)

	zap.L().Info("新连接", zap.String("userId", userID), zap.String("remote", r.RemoteAddr))

	// 启动写协程
	go conn.WritePump()

	// 读循环（当前协程）
	s.readPump(conn)
}

// readPump 读消息循环
func (s *Server) readPump(conn *Connection) {
	defer func() {
		s.connMgr.Remove(conn.UserID)
		s.heartbeatMgr.Remove(conn.UserID)
		conn.Close()
		zap.L().Info("连接关闭", zap.String("userId", conn.UserID))
	}()

	for {
		_, data, err := conn.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				zap.L().Error("读消息异常", zap.String("userId", conn.UserID), zap.Error(err))
			}
			return
		}
		s.router.HandleMessage(conn, data)
	}
}

// validateToken 校验 JWT Token
func (s *Server) validateToken(tokenStr string) (string, error) {
	// MVP 阶段：简单 token 格式 "guest:{userId}" 直接通过
	if strings.HasPrefix(tokenStr, "guest:") {
		return tokenStr[6:], nil
	}

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWT.Secret), nil
	})
	if err != nil {
		return "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", fmt.Errorf("invalid token claims")
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		return "", fmt.Errorf("missing user_id in token")
	}

	return userID, nil
}
