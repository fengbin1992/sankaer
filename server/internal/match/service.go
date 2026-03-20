package match

import (
	"encoding/json"

	"github.com/nats-io/nats.go"
	"go.uber.org/zap"
	"sankaer/internal/pkg/config"
	pkgNats "sankaer/internal/pkg/nats"
	"sankaer/internal/pkg/pb"
)

// Service 匹配服务
type Service struct {
	cfg     *config.AppConfig
	matcher *Matcher
}

// NewService 创建匹配服务
func NewService(cfg *config.AppConfig) *Service {
	svc := &Service{cfg: cfg}
	svc.matcher = NewMatcher(svc.onMatched)
	return svc
}

// Start 启动服务
func (s *Service) Start() error {
	// 订阅匹配请求
	_, err := pkgNats.Conn.Subscribe("match.c2s", func(msg *nats.Msg) {
		s.handleMessage(msg)
	})
	if err != nil {
		return err
	}

	// 启动匹配器
	s.matcher.Start()

	zap.L().Info("匹配服务 NATS 订阅就绪")
	return nil
}

// Stop 停止
func (s *Service) Stop() {
	s.matcher.Stop()
}

// handleMessage 处理消息
func (s *Service) handleMessage(msg *nats.Msg) {
	var natsMsg struct {
		UserID  string          `json:"user_id"`
		MsgType uint32          `json:"msg_type"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(msg.Data, &natsMsg); err != nil {
		zap.L().Error("匹配服务消息解码失败", zap.Error(err))
		return
	}

	switch natsMsg.MsgType {
	case pb.MsgC2SQuickMatch:
		s.handleQuickMatch(natsMsg.UserID, natsMsg.Payload)
	case pb.MsgC2SCancelMatch:
		s.handleCancelMatch(natsMsg.UserID)
	default:
		zap.L().Warn("匹配服务收到未处理消息", zap.Uint32("msgType", natsMsg.MsgType))
	}
}

// handleQuickMatch 处理快速匹配
func (s *Service) handleQuickMatch(userID string, payload json.RawMessage) {
	var req pb.C2SQuickMatch
	if err := json.Unmarshal(payload, &req); err != nil {
		zap.L().Error("解析匹配请求失败", zap.Error(err))
		return
	}

	tier := req.Tier
	if tier == 0 {
		tier = 10 // 默认 10 倍场
	}

	// 加入队列
	if err := JoinQueue(tier, userID); err != nil {
		zap.L().Error("加入匹配队列失败", zap.Error(err))
		return
	}
	SetPlayerTier(userID, tier)

	zap.L().Info("玩家加入匹配",
		zap.String("userId", userID),
		zap.Uint32("tier", tier),
	)

	// 发送匹配状态更新
	s.sendMatchUpdate(userID, tier)
}

// handleCancelMatch 处理取消匹配
func (s *Service) handleCancelMatch(userID string) {
	RemovePlayerData(userID)
	zap.L().Info("玩家取消匹配", zap.String("userId", userID))
}

// onMatched 匹配成功回调
func (s *Service) onMatched(roomID string, tier uint32, playerIDs []string) {
	// 通知游戏服务创建房间
	createMsg, _ := json.Marshal(map[string]interface{}{
		"room_id":    roomID,
		"tier":       tier,
		"player_ids": playerIDs,
	})
	pkgNats.Conn.Publish("game.create_room", createMsg)

	// 构建玩家信息列表
	players := make([]*pb.PlayerInfoDTO, len(playerIDs))
	for i, pid := range playerIDs {
		players[i] = &pb.PlayerInfoDTO{
			UserID:  pid,
			SeatIdx: uint32(i),
		}
	}

	// 通知每个玩家加入房间
	result := &pb.S2CRoomJoined{
		RoomID:  roomID,
		Players: players,
		Tier:    tier,
	}
	data, _ := pb.Encode(pb.MsgS2CRoomJoined, 0, result)

	for _, pid := range playerIDs {
		// 设置玩家的房间 ID
		roomData, _ := json.Marshal(map[string]string{"room_id": roomID})
		pkgNats.Conn.Publish("gateway.set_room."+pid, roomData)

		// 发送房间加入通知
		pkgNats.Conn.Publish("gateway.s2c."+pid, data)
	}
}

// sendMatchUpdate 发送匹配状态
func (s *Service) sendMatchUpdate(userID string, tier uint32) {
	queueSize, elapsed, _ := GetWaitingInfo(tier, userID)
	update := &pb.S2CMatchUpdate{
		WaitingCount: uint32(queueSize),
		ElapsedSec:   elapsed,
	}
	data, _ := pb.Encode(pb.MsgS2CMatchUpdate, 0, update)
	pkgNats.Conn.Publish("gateway.s2c."+userID, data)
}
