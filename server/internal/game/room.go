package game

import (
	"errors"
	"fmt"
	"sync"
)

const (
	MaxPlayers   = 5
	HandSize     = 10
	BottomSize   = 4
	TotalRounds  = 10
)

// Player 玩家
type Player struct {
	ID       string
	SeatIdx  int    // 座位号 0~4
	Hand     []Card // 手牌
	Ready    bool
	Online   bool
	Managed  bool   // 是否托管中
}

// Room 房间
type Room struct {
	mu sync.Mutex

	ID        string
	State     GameState
	Players   [MaxPlayers]*Player
	GameCount int // 已玩局数

	// 当局游戏数据
	TrumpSuit    Suit   // 主花色
	DealerIdx    int    // 庄家座位号
	FirstIdx     int    // 首家座位号
	PartnerCard  Card   // 搭档牌
	PartnerIdx   int    // 搭档座位号（-1 表示未知）
	BidScore     int    // 叫分值
	Bottom       []Card // 底牌
	IsSolo       bool   // 是否 1v4（庄家叫自己）
	IsForced     bool   // 是否强制叫分
	IsAbandoned  bool   // 是否弃局

	// 叫分相关
	BidManager *BidManager

	// 出牌相关
	CurrentRound  int       // 当前轮次 0~9
	LeadIdx       int       // 当前轮领出者座位号
	RoundCards    [MaxPlayers]Card // 当前轮各玩家出的牌
	RoundPlayed   [MaxPlayers]bool // 当前轮谁出了牌
	TricksTaken   [MaxPlayers]int  // 每个玩家赢的轮数
	PointsTaken   [2]int          // [0]=庄家方得分, [1]=抓分方得分
	LastWinnerIdx int              // 最后一手赢家

	// 阵营: true=庄家方, false=抓分方
	Teams [MaxPlayers]bool

	// 倒计时管理
	Timer *TimerManager
}

// NewRoom 创建新房间
func NewRoom(id string) *Room {
	return &Room{
		ID:          id,
		State:       StateWaiting,
		PartnerIdx:  -1,
		DealerIdx:   -1,
		FirstIdx:    -1,
		LeadIdx:     -1,
	}
}

// PlayerCount 当前玩家数量
func (r *Room) PlayerCount() int {
	count := 0
	for _, p := range r.Players {
		if p != nil {
			count++
		}
	}
	return count
}

// Join 玩家加入房间
func (r *Room) Join(playerID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StateWaiting {
		return -1, errors.New("游戏已开始，无法加入")
	}

	// 检查是否已在房间
	for i, p := range r.Players {
		if p != nil && p.ID == playerID {
			return i, nil
		}
	}

	// 找空位
	for i, p := range r.Players {
		if p == nil {
			r.Players[i] = &Player{
				ID:      playerID,
				SeatIdx: i,
				Online:  true,
			}
			return i, nil
		}
	}
	return -1, errors.New("房间已满")
}

// Leave 玩家离开房间
func (r *Room) Leave(playerID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StateWaiting {
		return errors.New("游戏进行中，不能离开")
	}

	for i, p := range r.Players {
		if p != nil && p.ID == playerID {
			r.Players[i] = nil
			return nil
		}
	}
	return errors.New("玩家不在房间中")
}

// SetReady 玩家准备
func (r *Room) SetReady(playerID string, ready bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StateWaiting {
		return errors.New("当前状态不能操作准备")
	}

	for _, p := range r.Players {
		if p != nil && p.ID == playerID {
			p.Ready = ready
			return nil
		}
	}
	return errors.New("玩家不在房间中")
}

// AllReady 检查是否5人全部就绪
func (r *Room) AllReady() bool {
	if r.PlayerCount() != MaxPlayers {
		return false
	}
	for _, p := range r.Players {
		if p == nil || !p.Ready {
			return false
		}
	}
	return true
}

// transit 状态转移（内部方法，调用者需持有锁）
func (r *Room) transit(to GameState) error {
	if !CanTransit(r.State, to) {
		return fmt.Errorf("非法状态转移: %v -> %v", r.State, to)
	}
	r.State = to
	return nil
}

// StartGame 开局
func (r *Room) StartGame() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.AllReady() {
		return errors.New("玩家未全部就绪")
	}

	// 重置当局数据
	r.resetGameData()

	// 首局需要翻牌定首家
	if r.GameCount == 0 {
		return r.transit(StateFlipping)
	}

	// 后续局：首家逆时针轮流
	r.FirstIdx = (r.FirstIdx + 1) % MaxPlayers
	return r.transit(StateDealing)
}

// resetGameData 重置当局游戏数据
func (r *Room) resetGameData() {
	r.TrumpSuit = SuitNone
	r.DealerIdx = -1
	r.PartnerCard = Card{}
	r.PartnerIdx = -1
	r.BidScore = 0
	r.Bottom = nil
	r.IsSolo = false
	r.IsForced = false
	r.IsAbandoned = false
	r.BidManager = nil
	r.CurrentRound = 0
	r.LeadIdx = -1
	r.RoundCards = [MaxPlayers]Card{}
	r.RoundPlayed = [MaxPlayers]bool{}
	r.TricksTaken = [MaxPlayers]int{}
	r.PointsTaken = [2]int{}
	r.LastWinnerIdx = -1
	r.Teams = [MaxPlayers]bool{}

	for _, p := range r.Players {
		if p != nil {
			p.Hand = nil
			p.Ready = false
		}
	}
}

// GetPlayer 获取座位号对应的玩家
func (r *Room) GetPlayer(seatIdx int) *Player {
	if seatIdx < 0 || seatIdx >= MaxPlayers {
		return nil
	}
	return r.Players[seatIdx]
}

// FindPlayer 通过ID查找玩家
func (r *Room) FindPlayer(playerID string) *Player {
	for _, p := range r.Players {
		if p != nil && p.ID == playerID {
			return p
		}
	}
	return nil
}

// NextSeat 逆时针方向下一个座位
func NextSeat(current int) int {
	return (current + 1) % MaxPlayers
}

// SetTeams 设置阵营
func (r *Room) SetTeams() {
	for i := 0; i < MaxPlayers; i++ {
		r.Teams[i] = false // 默认抓分方
	}
	r.Teams[r.DealerIdx] = true // 庄家
	if !r.IsSolo && r.PartnerIdx >= 0 {
		r.Teams[r.PartnerIdx] = true // 搭档
	}
}
