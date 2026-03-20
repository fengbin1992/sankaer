package pb

// 消息类型 ID 常量
// C2S: 1xxx 客户端→服务端
// S2C: 2xxx 服务端→客户端
// 系统: 9xxx 心跳等
const (
	// === 系统消息 ===
	MsgPing uint32 = 9001
	MsgPong uint32 = 9002

	// === 登录 C2S ===
	MsgC2SGuestLogin uint32 = 1001 // 游客登录
	MsgC2SWechatLogin uint32 = 1002
	MsgC2SPhoneLogin  uint32 = 1003

	// === 登录 S2C ===
	MsgS2CLoginResult uint32 = 2001

	// === 房间/匹配 C2S ===
	MsgC2SQuickMatch   uint32 = 1101
	MsgC2SCancelMatch  uint32 = 1102
	MsgC2SCreateRoom   uint32 = 1103
	MsgC2SJoinRoom     uint32 = 1104
	MsgC2SLeaveRoom    uint32 = 1105
	MsgC2SReady        uint32 = 1106
	MsgC2SCancelReady  uint32 = 1107

	// === 房间/匹配 S2C ===
	MsgS2CMatchUpdate  uint32 = 2101
	MsgS2CRoomJoined   uint32 = 2102
	MsgS2CPlayerJoined uint32 = 2103
	MsgS2CPlayerLeft   uint32 = 2104
	MsgS2CReadyUpdate  uint32 = 2105

	// === 游戏 C2S ===
	MsgC2SFlipCard     uint32 = 1201
	MsgC2SBid          uint32 = 1202
	MsgC2SPassBid      uint32 = 1203
	MsgC2SForfeit      uint32 = 1204
	MsgC2SSetBottom    uint32 = 1205
	MsgC2SCallPartner  uint32 = 1206
	MsgC2SPlayCard     uint32 = 1207
	MsgC2SAutoPlay     uint32 = 1208
	MsgC2SChat         uint32 = 1209

	// === 游戏 S2C ===
	MsgS2CRoomState      uint32 = 2201 // 全量同步（断线重连）
	MsgS2CDealCards      uint32 = 2202
	MsgS2CFlipResult     uint32 = 2203
	MsgS2CBidUpdate      uint32 = 2204
	MsgS2CBidResult      uint32 = 2205
	MsgS2CAllPassed      uint32 = 2206
	MsgS2CBottomCards    uint32 = 2207
	MsgS2CPartnerCalled  uint32 = 2208
	MsgS2CTurn           uint32 = 2209
	MsgS2CCardPlayed     uint32 = 2210
	MsgS2CRoundResult    uint32 = 2211
	MsgS2CGameResult     uint32 = 2212
	MsgS2CGameStart      uint32 = 2213 // 游戏开始通知
	MsgS2CError          uint32 = 2999 // 错误消息
)
