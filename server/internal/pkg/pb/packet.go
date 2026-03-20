package pb

import "encoding/json"

// Packet JSON 消息包
type Packet struct {
	MsgType uint32          `json:"msg_type"`
	Seq     uint32          `json:"seq"`
	Payload json.RawMessage `json:"payload"`
}

// Encode 编码 Packet 为 JSON 字节
func Encode(msgType uint32, seq uint32, payload interface{}) ([]byte, error) {
	var raw json.RawMessage
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		raw = b
	}
	pkt := Packet{
		MsgType: msgType,
		Seq:     seq,
		Payload: raw,
	}
	return json.Marshal(pkt)
}

// Decode 解码 JSON 字节为 Packet
func Decode(data []byte) (*Packet, error) {
	var pkt Packet
	if err := json.Unmarshal(data, &pkt); err != nil {
		return nil, err
	}
	return &pkt, nil
}

// DecodePayload 从 Packet 中解码 payload 到目标结构
func DecodePayload(pkt *Packet, v interface{}) error {
	if pkt.Payload == nil {
		return nil
	}
	return json.Unmarshal(pkt.Payload, v)
}

// === 通用数据结构 ===

// CardDTO 牌面数据
type CardDTO struct {
	Suit uint32 `json:"suit"` // 1=黑桃 2=红心 3=方块 4=梅花 5=王
	Rank uint32 `json:"rank"` // 1-13, 14=小王, 15=大王
}

// PlayerInfoDTO 玩家信息
type PlayerInfoDTO struct {
	UserID   string `json:"user_id"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	SeatIdx  uint32 `json:"seat_idx"`
	IsReady  bool   `json:"is_ready"`
	IsOnline bool   `json:"is_online"`
	Platform string `json:"platform"`
}

// === C2S 消息体 ===

type C2SGuestLogin struct {
	DeviceID string `json:"device_id"`
	Platform string `json:"platform"`
}

type C2SQuickMatch struct {
	Tier uint32 `json:"tier"` // 10/100/1000/10000
}

type C2SJoinRoom struct {
	RoomID string `json:"room_id"`
}

type C2SCreateRoom struct {
	Tier uint32 `json:"tier"`
}

type C2SBid struct {
	Score uint32 `json:"score"` // 75/80/85/90/95/100, 0=不叫
	Suit  uint32 `json:"suit"`
}

type C2SSetBottom struct {
	Cards []CardDTO `json:"cards"` // 4 张
}

type C2SCallPartner struct {
	Card CardDTO `json:"card"`
}

type C2SPlayCard struct {
	Card CardDTO `json:"card"`
}

type C2SAutoPlay struct {
	Enable bool `json:"enable"`
}

type C2SChat struct {
	ChatID uint32 `json:"chat_id"`
}

// === S2C 消息体 ===

type S2CLoginResult struct {
	Success  bool           `json:"success"`
	Token    string         `json:"token"`
	Player   *PlayerInfoDTO `json:"player"`
	Coins    int64          `json:"coins"`
	ErrorMsg string         `json:"error_msg,omitempty"`
}

type S2CMatchUpdate struct {
	WaitingCount uint32 `json:"waiting_count"`
	ElapsedSec   uint32 `json:"elapsed_sec"`
}

type S2CRoomJoined struct {
	RoomID  string           `json:"room_id"`
	Players []*PlayerInfoDTO `json:"players"`
	Tier    uint32           `json:"tier"`
}

type S2CPlayerJoined struct {
	Player *PlayerInfoDTO `json:"player"`
}

type S2CPlayerLeft struct {
	UserID string `json:"user_id"`
}

type S2CReadyUpdate struct {
	UserID  string `json:"user_id"`
	IsReady bool   `json:"is_ready"`
}

type S2CGameStart struct {
	RoomID string `json:"room_id"`
}

type S2CDealCards struct {
	Cards []CardDTO `json:"cards"` // 10 张手牌
}

type S2CFlipResult struct {
	Card          CardDTO `json:"card"`
	Value         uint32  `json:"value"`
	FirstDealerID string  `json:"first_dealer_id"`
}

type S2CBidUpdate struct {
	PlayerID string `json:"player_id"`
	Score    uint32 `json:"score"`
	Suit     uint32 `json:"suit"`
}

type S2CBidResult struct {
	DealerID string `json:"dealer_id"`
	Score    uint32 `json:"score"`
	Suit     uint32 `json:"suit"`
}

type S2CAllPassed struct {
	ForcedDealerID string `json:"forced_dealer_id"`
}

type S2CBottomCards struct {
	Cards []CardDTO `json:"cards"` // 4 张底牌
}

type S2CPartnerCalled struct {
	Card   CardDTO `json:"card"`
	IsSolo bool    `json:"is_solo"`
}

type S2CTurn struct {
	PlayerID string `json:"player_id"`
	Timeout  uint32 `json:"timeout"` // 秒
}

type S2CCardPlayed struct {
	PlayerID string  `json:"player_id"`
	Card     CardDTO `json:"card"`
}

type S2CRoundResult struct {
	WinnerID          string `json:"winner_id"`
	Points            uint32 `json:"points"`
	TotalCatcherScore uint32 `json:"total_catcher_score"`
}

type RoundPlayDTO struct {
	PlayerID string  `json:"player_id"`
	Card     CardDTO `json:"card"`
}

type S2CRoomState struct {
	RoomID       string          `json:"room_id"`
	Players      []*PlayerInfoDTO `json:"players"`
	Status       string          `json:"status"`
	TrumpSuit    uint32          `json:"trump_suit"`
	BidScore     uint32          `json:"bid_score"`
	DealerID     string          `json:"dealer_id"`
	PartnerCard  *CardDTO        `json:"partner_card,omitempty"`
	IsSolo       bool            `json:"is_solo"`
	CurrentRound uint32          `json:"current_round"`
	CurrentTurn  string          `json:"current_turn"`
	CatcherScore uint32          `json:"catcher_score"`
	MyHand       []CardDTO       `json:"my_hand"`
	CurrentPlays []RoundPlayDTO  `json:"current_plays"`
}

type SettlementDTO struct {
	PlayerID   string `json:"player_id"`
	Role       string `json:"role"`       // dealer/partner/catcher
	Multiplier int32  `json:"multiplier"`
	Amount     int64  `json:"amount"`     // 正=赢 负=输
}

type S2CGameResult struct {
	BidScore        uint32           `json:"bid_score"`
	CatcherScore    uint32           `json:"catcher_score"`
	BottomPoints    uint32           `json:"bottom_points"`
	BottomDoubled   bool             `json:"bottom_doubled"`
	Winner          string           `json:"winner"` // dealer/catcher/forfeit
	IsSolo          bool             `json:"is_solo"`
	IsZeroClear     bool             `json:"is_zero_clear"`
	IsLastHandBonus bool             `json:"is_last_hand_bonus"`
	DealerID        string           `json:"dealer_id"`
	PartnerID       string           `json:"partner_id"`
	PartnerCard     *CardDTO         `json:"partner_card"`
	Settlements     []SettlementDTO  `json:"settlements"`
}

type S2CError struct {
	Code    int32  `json:"code"`
	Message string `json:"message"`
}
