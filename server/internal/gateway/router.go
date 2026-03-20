package gateway

import (
	"encoding/json"

	"github.com/nats-io/nats.go"
	"go.uber.org/zap"
	"sankaer/internal/pkg/pb"
	pkgNats "sankaer/internal/pkg/nats"
)

// Router 消息路由：客户端消息 → NATS 转发
type Router struct {
	connMgr      *ConnManager
	heartbeatMgr *HeartbeatManager
}

// NewRouter 创建路由
func NewRouter(connMgr *ConnManager, hbMgr *HeartbeatManager) *Router {
	return &Router{
		connMgr:      connMgr,
		heartbeatMgr: hbMgr,
	}
}

// HandleMessage 处理客户端消息
func (r *Router) HandleMessage(conn *Connection, data []byte) {
	pkt, err := pb.Decode(data)
	if err != nil {
		zap.L().Error("消息解码失败", zap.String("userId", conn.UserID), zap.Error(err))
		return
	}

	switch {
	case pkt.MsgType == pb.MsgPing:
		r.handlePing(conn)
	case pkt.MsgType >= 1001 && pkt.MsgType <= 1099:
		r.forwardToUser(conn, pkt)
	case pkt.MsgType == pb.MsgC2SQuickMatch || pkt.MsgType == pb.MsgC2SCancelMatch:
		r.forwardToMatch(conn, pkt)
	case pkt.MsgType >= 1100 && pkt.MsgType <= 1199:
		// 房间操作（准备/取消准备/离开房间等）转发到游戏服务
		r.forwardToGame(conn, pkt)
	case pkt.MsgType >= 1200 && pkt.MsgType <= 1299:
		r.forwardToGame(conn, pkt)
	default:
		zap.L().Warn("未知消息类型", zap.Uint32("msgType", pkt.MsgType))
	}
}

// handlePing 处理心跳
func (r *Router) handlePing(conn *Connection) {
	r.heartbeatMgr.RecordPing(conn.UserID)
	// 回复 PONG
	pongData, _ := pb.Encode(pb.MsgPong, 0, nil)
	conn.Send(pongData)
}

// NatsMessage NATS 转发的消息格式
type NatsMessage struct {
	UserID  string          `json:"user_id"`
	RoomID  string          `json:"room_id,omitempty"`
	MsgType uint32          `json:"msg_type"`
	Payload json.RawMessage `json:"payload"`
}

// forwardToUser 转发到用户服务
func (r *Router) forwardToUser(conn *Connection, pkt *pb.Packet) {
	msg := NatsMessage{
		UserID:  conn.UserID,
		MsgType: pkt.MsgType,
		Payload: pkt.Payload,
	}
	data, _ := json.Marshal(msg)
	if err := pkgNats.Conn.Publish("user.c2s", data); err != nil {
		zap.L().Error("转发到用户服务失败", zap.Error(err))
	}
}

// forwardToMatch 转发到匹配服务
func (r *Router) forwardToMatch(conn *Connection, pkt *pb.Packet) {
	msg := NatsMessage{
		UserID:  conn.UserID,
		MsgType: pkt.MsgType,
		Payload: pkt.Payload,
	}
	data, _ := json.Marshal(msg)
	if err := pkgNats.Conn.Publish("match.c2s", data); err != nil {
		zap.L().Error("转发到匹配服务失败", zap.Error(err))
	}
}

// forwardToGame 转发到游戏服务
func (r *Router) forwardToGame(conn *Connection, pkt *pb.Packet) {
	msg := NatsMessage{
		UserID:  conn.UserID,
		RoomID:  conn.RoomID,
		MsgType: pkt.MsgType,
		Payload: pkt.Payload,
	}
	data, _ := json.Marshal(msg)

	// 按房间 ID 路由
	subject := "game.c2s"
	if conn.RoomID != "" {
		subject = "game." + conn.RoomID + ".c2s"
	}
	if err := pkgNats.Conn.Publish(subject, data); err != nil {
		zap.L().Error("转发到游戏服务失败", zap.Error(err))
	}
}

// SubscribeS2C 订阅服务端推送，转发给客户端
func (r *Router) SubscribeS2C() error {
	// 订阅单播消息: gateway.s2c.{userId}
	_, err := pkgNats.Conn.Subscribe("gateway.s2c.*", func(msg *nats.Msg) {
		// subject 格式: gateway.s2c.{userId}
		// 提取 userId
		userID := msg.Subject[len("gateway.s2c."):]
		r.connMgr.SendTo(userID, msg.Data)
	})
	if err != nil {
		return err
	}

	// 订阅广播消息: gateway.broadcast
	_, err = pkgNats.Conn.Subscribe("gateway.broadcast", func(msg *nats.Msg) {
		// 消息体包含 user_ids 和 data
		var broadcastMsg struct {
			UserIDs []string        `json:"user_ids"`
			Data    json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(msg.Data, &broadcastMsg); err != nil {
			zap.L().Error("广播消息解码失败", zap.Error(err))
			return
		}
		r.connMgr.Broadcast(broadcastMsg.UserIDs, broadcastMsg.Data)
	})
	if err != nil {
		return err
	}

	// 订阅设置房间 ID: gateway.set_room.{userId}
	_, err = pkgNats.Conn.Subscribe("gateway.set_room.*", func(msg *nats.Msg) {
		userID := msg.Subject[len("gateway.set_room."):]
		var roomMsg struct {
			RoomID string `json:"room_id"`
		}
		if err := json.Unmarshal(msg.Data, &roomMsg); err != nil {
			return
		}
		if conn := r.connMgr.Get(userID); conn != nil {
			conn.RoomID = roomMsg.RoomID
		}
	})
	if err != nil {
		return err
	}

	// 订阅更新用户 ID: gateway.update_user.{oldUserId}
	_, err = pkgNats.Conn.Subscribe("gateway.update_user.*", func(msg *nats.Msg) {
		oldUserID := msg.Subject[len("gateway.update_user."):]
		var updateMsg struct {
			NewUserID string `json:"new_user_id"`
		}
		if err := json.Unmarshal(msg.Data, &updateMsg); err != nil {
			return
		}
		r.connMgr.UpdateUserID(oldUserID, updateMsg.NewUserID)
		r.heartbeatMgr.RecordPing(updateMsg.NewUserID)
	})

	return err
}
