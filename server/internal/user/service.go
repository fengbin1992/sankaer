package user

import (
	"encoding/json"
	"time"

	"github.com/nats-io/nats.go"
	"go.uber.org/zap"
	"sankaer/internal/pkg/config"
	pkgNats "sankaer/internal/pkg/nats"
	"sankaer/internal/pkg/pb"
)

// Service 用户服务
type Service struct {
	cfg *config.AppConfig
}

// NewService 创建用户服务
func NewService(cfg *config.AppConfig) *Service {
	return &Service{cfg: cfg}
}

// Start 启动用户服务，订阅 NATS 消息
func (s *Service) Start() error {
	_, err := pkgNats.Conn.Subscribe("user.c2s", func(msg *nats.Msg) {
		s.handleMessage(msg)
	})
	if err != nil {
		return err
	}
	zap.L().Info("用户服务 NATS 订阅就绪")
	return nil
}

// handleMessage 处理消息
func (s *Service) handleMessage(msg *nats.Msg) {
	var natsMsg struct {
		UserID  string          `json:"user_id"`
		MsgType uint32          `json:"msg_type"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(msg.Data, &natsMsg); err != nil {
		zap.L().Error("用户服务消息解码失败", zap.Error(err))
		return
	}

	switch natsMsg.MsgType {
	case pb.MsgC2SGuestLogin:
		s.handleGuestLogin(natsMsg.UserID, natsMsg.Payload)
	default:
		zap.L().Warn("用户服务收到未处理消息", zap.Uint32("msgType", natsMsg.MsgType))
	}
}

// handleGuestLogin 处理游客登录
func (s *Service) handleGuestLogin(connUserID string, payload json.RawMessage) {
	var req pb.C2SGuestLogin
	if err := json.Unmarshal(payload, &req); err != nil {
		zap.L().Error("解析游客登录请求失败", zap.Error(err))
		return
	}

	// 解析 JWT 过期时间
	expire, err := time.ParseDuration(s.cfg.JWT.Expire)
	if err != nil {
		expire = 168 * time.Hour // 默认 7 天
	}

	user, token, err := GuestLogin(req.DeviceID, s.cfg.JWT.Secret, expire)
	if err != nil {
		s.sendLoginResult(connUserID, &pb.S2CLoginResult{
			Success:  false,
			ErrorMsg: "登录失败: " + err.Error(),
		})
		return
	}

	// 发送登录结果给原始连接（connUserID 是网关注册的连接 ID）
	s.sendLoginResult(connUserID, &pb.S2CLoginResult{
		Success: true,
		Token:   token,
		Player: &pb.PlayerInfoDTO{
			UserID:   user.UserID,
			Nickname: user.Nickname,
			Avatar:   user.Avatar,
			Platform: req.Platform,
		},
		Coins: user.Coins,
	})

	// 通知网关更新连接的 userId 映射
	if connUserID != user.UserID {
		updateData, _ := json.Marshal(struct {
			NewUserID string `json:"new_user_id"`
		}{NewUserID: user.UserID})
		pkgNats.Conn.Publish("gateway.update_user."+connUserID, updateData)
	}
}

// sendLoginResult 发送登录结果给网关
func (s *Service) sendLoginResult(userID string, result *pb.S2CLoginResult) {
	data, err := pb.Encode(pb.MsgS2CLoginResult, 0, result)
	if err != nil {
		zap.L().Error("编码登录结果失败", zap.Error(err))
		return
	}
	subject := "gateway.s2c." + userID
	if err := pkgNats.Conn.Publish(subject, data); err != nil {
		zap.L().Error("发送登录结果失败", zap.Error(err))
	}
}
