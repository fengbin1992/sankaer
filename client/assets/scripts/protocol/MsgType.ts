/**
 * MsgType.ts - 消息类型 ID 常量
 * 与服务端 pb/msgtype.go 保持一致
 */

// === 系统消息 ===
export const MSG_PING = 9001;
export const MSG_PONG = 9002;

// === 登录 C2S ===
export const MSG_C2S_GUEST_LOGIN = 1001;
export const MSG_C2S_WECHAT_LOGIN = 1002;
export const MSG_C2S_PHONE_LOGIN = 1003;

// === 登录 S2C ===
export const MSG_S2C_LOGIN_RESULT = 2001;

// === 房间/匹配 C2S ===
export const MSG_C2S_QUICK_MATCH = 1101;
export const MSG_C2S_CANCEL_MATCH = 1102;
export const MSG_C2S_CREATE_ROOM = 1103;
export const MSG_C2S_JOIN_ROOM = 1104;
export const MSG_C2S_LEAVE_ROOM = 1105;
export const MSG_C2S_READY = 1106;
export const MSG_C2S_CANCEL_READY = 1107;

// === 房间/匹配 S2C ===
export const MSG_S2C_MATCH_UPDATE = 2101;
export const MSG_S2C_ROOM_JOINED = 2102;
export const MSG_S2C_PLAYER_JOINED = 2103;
export const MSG_S2C_PLAYER_LEFT = 2104;
export const MSG_S2C_READY_UPDATE = 2105;

// === 游戏 C2S ===
export const MSG_C2S_FLIP_CARD = 1201;
export const MSG_C2S_BID = 1202;
export const MSG_C2S_PASS_BID = 1203;
export const MSG_C2S_FORFEIT = 1204;
export const MSG_C2S_SET_BOTTOM = 1205;
export const MSG_C2S_CALL_PARTNER = 1206;
export const MSG_C2S_PLAY_CARD = 1207;
export const MSG_C2S_AUTO_PLAY = 1208;
export const MSG_C2S_CHAT = 1209;

// === 游戏 S2C ===
export const MSG_S2C_ROOM_STATE = 2201;
export const MSG_S2C_DEAL_CARDS = 2202;
export const MSG_S2C_FLIP_RESULT = 2203;
export const MSG_S2C_BID_UPDATE = 2204;
export const MSG_S2C_BID_RESULT = 2205;
export const MSG_S2C_ALL_PASSED = 2206;
export const MSG_S2C_BOTTOM_CARDS = 2207;
export const MSG_S2C_PARTNER_CALLED = 2208;
export const MSG_S2C_TURN = 2209;
export const MSG_S2C_CARD_PLAYED = 2210;
export const MSG_S2C_ROUND_RESULT = 2211;
export const MSG_S2C_GAME_RESULT = 2212;
export const MSG_S2C_GAME_START = 2213;
export const MSG_S2C_ERROR = 2999;
