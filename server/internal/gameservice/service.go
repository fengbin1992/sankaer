package gameservice

import (
	"encoding/json"
	"sync"

	"github.com/nats-io/nats.go"
	"go.uber.org/zap"
	"sankaer/internal/game"
	"sankaer/internal/pkg/config"
	pkgNats "sankaer/internal/pkg/nats"
	"sankaer/internal/pkg/pb"
)

// Service 游戏逻辑服务
type Service struct {
	cfg       *config.AppConfig
	mu        sync.RWMutex
	rooms     map[string]*game.Room   // roomId → Room
	roomTiers map[string]uint32       // roomId → tier
}

// NewService 创建游戏服务
func NewService(cfg *config.AppConfig) *Service {
	return &Service{
		cfg:       cfg,
		rooms:     make(map[string]*game.Room),
		roomTiers: make(map[string]uint32),
	}
}

// Start 启动服务
func (s *Service) Start() error {
	// 订阅创建房间
	if _, err := pkgNats.Conn.Subscribe("game.create_room", func(msg *nats.Msg) {
		s.handleCreateRoom(msg)
	}); err != nil {
		return err
	}

	// 订阅游戏 C2S 消息（通配符）
	if _, err := pkgNats.Conn.Subscribe("game.*.c2s", func(msg *nats.Msg) {
		s.handleGameMessage(msg)
	}); err != nil {
		return err
	}

	// 订阅不带房间 ID 的消息
	if _, err := pkgNats.Conn.Subscribe("game.c2s", func(msg *nats.Msg) {
		s.handleGameMessage(msg)
	}); err != nil {
		return err
	}

	zap.L().Info("游戏逻辑服务 NATS 订阅就绪")
	return nil
}

// handleCreateRoom 处理创建房间
func (s *Service) handleCreateRoom(msg *nats.Msg) {
	var req struct {
		RoomID    string   `json:"room_id"`
		Tier      uint32   `json:"tier"`
		PlayerIDs []string `json:"player_ids"`
	}
	if err := json.Unmarshal(msg.Data, &req); err != nil {
		zap.L().Error("解析创建房间消息失败", zap.Error(err))
		return
	}

	s.mu.Lock()
	room := game.NewRoom(req.RoomID)
	s.rooms[req.RoomID] = room
	s.roomTiers[req.RoomID] = req.Tier

	// 玩家加入房间
	for _, pid := range req.PlayerIDs {
		if _, err := room.Join(pid); err != nil {
			zap.L().Error("玩家加入房间失败", zap.String("userId", pid), zap.Error(err))
		}
	}
	s.mu.Unlock()

	zap.L().Info("房间创建成功",
		zap.String("roomId", req.RoomID),
		zap.Uint32("tier", req.Tier),
		zap.Int("players", room.PlayerCount()),
	)
}

// handleGameMessage 处理游戏消息
func (s *Service) handleGameMessage(msg *nats.Msg) {
	var natsMsg struct {
		UserID  string          `json:"user_id"`
		RoomID  string          `json:"room_id"`
		MsgType uint32          `json:"msg_type"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(msg.Data, &natsMsg); err != nil {
		zap.L().Error("游戏消息解码失败", zap.Error(err))
		return
	}

	roomID := natsMsg.RoomID
	userID := natsMsg.UserID

	// 如果没有 roomID，尝试从玩家查找
	if roomID == "" {
		roomID = s.findRoomByUser(userID)
	}

	switch natsMsg.MsgType {
	case pb.MsgC2SReady:
		s.handleReady(roomID, userID)
	case pb.MsgC2SCancelReady:
		s.handleCancelReady(roomID, userID)
	case pb.MsgC2SFlipCard:
		s.handleFlipCard(roomID, userID)
	case pb.MsgC2SBid:
		s.handleBid(roomID, userID, natsMsg.Payload)
	case pb.MsgC2SPassBid:
		s.handlePassBid(roomID, userID)
	case pb.MsgC2SForfeit:
		s.handleForfeit(roomID, userID)
	case pb.MsgC2SSetBottom:
		s.handleSetBottom(roomID, userID, natsMsg.Payload)
	case pb.MsgC2SCallPartner:
		s.handleCallPartner(roomID, userID, natsMsg.Payload)
	case pb.MsgC2SPlayCard:
		s.handlePlayCard(roomID, userID, natsMsg.Payload)
	case pb.MsgC2SLeaveRoom:
		s.handleLeaveRoom(roomID, userID)
	default:
		zap.L().Warn("游戏服务收到未处理消息", zap.Uint32("msgType", natsMsg.MsgType))
	}
}

// findRoomByUser 通过用户 ID 查找房间
func (s *Service) findRoomByUser(userID string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for roomID, room := range s.rooms {
		if room.FindPlayer(userID) != nil {
			return roomID
		}
	}
	return ""
}
