package gameservice

import (
	"encoding/json"

	"go.uber.org/zap"
	"sankaer/internal/pkg/pb"
	pkgNats "sankaer/internal/pkg/nats"
)

// sendToPlayer 向单个玩家发送消息
func sendToPlayer(userID string, msgType uint32, payload interface{}) {
	data, err := pb.Encode(msgType, 0, payload)
	if err != nil {
		zap.L().Error("编码消息失败", zap.Error(err))
		return
	}
	if err := pkgNats.Conn.Publish("gateway.s2c."+userID, data); err != nil {
		zap.L().Error("发送消息失败", zap.String("userId", userID), zap.Error(err))
	}
}

// broadcastToRoom 向房间内所有玩家广播消息
func broadcastToRoom(playerIDs []string, msgType uint32, payload interface{}) {
	data, err := pb.Encode(msgType, 0, payload)
	if err != nil {
		zap.L().Error("编码广播消息失败", zap.Error(err))
		return
	}

	broadcastMsg, _ := json.Marshal(map[string]interface{}{
		"user_ids": playerIDs,
		"data":     json.RawMessage(data),
	})
	if err := pkgNats.Conn.Publish("gateway.broadcast", broadcastMsg); err != nil {
		zap.L().Error("广播失败", zap.Error(err))
	}
}

// sendError 发送错误消息
func sendError(userID string, code int32, message string) {
	sendToPlayer(userID, pb.MsgS2CError, &pb.S2CError{
		Code:    code,
		Message: message,
	})
}

// getRoomPlayerIDs 获取房间内所有玩家 ID
func getRoomPlayerIDs(svc *Service, roomID string) []string {
	svc.mu.RLock()
	room, ok := svc.rooms[roomID]
	svc.mu.RUnlock()
	if !ok {
		return nil
	}

	var ids []string
	for _, p := range room.Players {
		if p != nil {
			ids = append(ids, p.ID)
		}
	}
	return ids
}
