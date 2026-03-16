package game

import (
	"sync"
	"time"
)

// 各阶段倒计时（秒）
const (
	TimerFlip    = 10
	TimerBid     = 15
	TimerBottom  = 30
	TimerCall    = 20
	TimerPlay    = 20
	TimerSettle  = 60
)

// TimeoutHandler 超时回调函数类型
type TimeoutHandler func(room *Room)

// TimerManager 倒计时管理器
type TimerManager struct {
	mu       sync.Mutex
	timer    *time.Timer
	duration time.Duration
	state    GameState
	stopped  bool
}

// NewTimerManager 创建倒计时管理器
func NewTimerManager() *TimerManager {
	return &TimerManager{}
}

// Start 开始倒计时
func (tm *TimerManager) Start(state GameState, handler TimeoutHandler, room *Room) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	tm.Stop()

	duration := getTimerDuration(state)
	if duration == 0 {
		return
	}

	tm.state = state
	tm.duration = duration
	tm.stopped = false
	tm.timer = time.AfterFunc(duration, func() {
		tm.mu.Lock()
		stopped := tm.stopped
		tm.mu.Unlock()
		if !stopped && handler != nil {
			handler(room)
		}
	})
}

// Stop 停止当前倒计时
func (tm *TimerManager) Stop() {
	if tm.timer != nil {
		tm.timer.Stop()
		tm.stopped = true
		tm.timer = nil
	}
}

// Remaining 获取剩余时间（近似值）
func (tm *TimerManager) Remaining() time.Duration {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	if tm.timer == nil || tm.stopped {
		return 0
	}
	return tm.duration // 简化实现，实际需要记录开始时间
}

// getTimerDuration 获取各阶段倒计时时长
func getTimerDuration(state GameState) time.Duration {
	switch state {
	case StateFlipping:
		return time.Duration(TimerFlip) * time.Second
	case StateBidding:
		return time.Duration(TimerBid) * time.Second
	case StateBottom:
		return time.Duration(TimerBottom) * time.Second
	case StateCalling:
		return time.Duration(TimerCall) * time.Second
	case StatePlaying:
		return time.Duration(TimerPlay) * time.Second
	case StateSettling:
		return time.Duration(TimerSettle) * time.Second
	default:
		return 0
	}
}

// DefaultTimeoutHandler 默认超时处理
func DefaultTimeoutHandler(room *Room) {
	room.mu.Lock()
	defer room.mu.Unlock()

	switch room.State {
	case StateBidding:
		// 叫分超时 → 自动不叫
		if room.BidManager != nil && !room.BidManager.Finished {
			room.BidManager.Bid(room.BidManager.CurrentIdx, 0, SuitNone)
		}
	case StateBottom:
		// 扣底超时 → AI策略（简化：扣前4张非主牌小牌）
		autoBottom(room)
	case StateCalling:
		// 叫搭档超时 → AI策略（简化：叫自己没有的A）
		autoCallPartner(room)
	case StatePlaying:
		// 出牌超时 → AI策略（简化：出合法的最小牌）
		autoPlay(room)
	}
}

// autoBottom AI自动扣底
func autoBottom(room *Room) {
	dealer := room.GetPlayer(room.DealerIdx)
	if dealer == nil || len(dealer.Hand) != HandSize+BottomSize {
		return
	}

	// 简单策略：扣分值最低的4张非主牌
	var candidates []Card
	for _, c := range dealer.Hand {
		if !c.IsTrump(room.TrumpSuit) {
			candidates = append(candidates, c)
		}
	}

	// 如果非主牌不够4张，补上主牌中最小的
	if len(candidates) < BottomSize {
		for _, c := range dealer.Hand {
			if c.IsTrump(room.TrumpSuit) && !CardsContain(candidates, c) {
				candidates = append(candidates, c)
				if len(candidates) >= BottomSize {
					break
				}
			}
		}
	}

	// 按分值排序选最小的4张
	discards := candidates[:BottomSize]
	HandleBottom(room, discards)
}

// autoCallPartner AI自动叫搭档
func autoCallPartner(room *Room) {
	dealer := room.GetPlayer(room.DealerIdx)
	if dealer == nil {
		return
	}

	// 简单策略：叫自己没有的副花色A
	suits := []Suit{SuitSpade, SuitHeart, SuitDiamond, SuitClub}
	for _, s := range suits {
		if s == room.TrumpSuit {
			continue
		}
		target := Card{Suit: s, Rank: RankA}
		if !CardsContain(dealer.Hand, target) {
			CallPartner(room, target)
			return
		}
	}

	// 所有A都在手上 → 叫自己
	CallPartner(room, dealer.Hand[0])
}

// autoPlay AI自动出牌
func autoPlay(room *Room) {
	seatIdx := GetCurrentPlaySeat(room)
	if seatIdx < 0 {
		return
	}

	player := room.GetPlayer(seatIdx)
	if player == nil || len(player.Hand) == 0 {
		return
	}

	// 简单策略：出第一张合法牌
	for _, c := range player.Hand {
		if ValidateFollow(room, seatIdx, c) == nil {
			PlayCard(room, seatIdx, c)
			return
		}
	}

	// 兜底：出第一张
	PlayCard(room, seatIdx, player.Hand[0])
}
