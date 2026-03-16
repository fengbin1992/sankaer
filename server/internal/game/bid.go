package game

import "errors"

const (
	BidMin  = 75
	BidMax  = 100
	BidStep = 5
)

// BidAction 叫分动作
type BidAction struct {
	SeatIdx   int
	Score     int  // 0 表示不叫
	TrumpSuit Suit // 叫分时选择的主花色
}

// BidManager 叫分管理器
type BidManager struct {
	FirstIdx    int         // 首家座位号
	CurrentIdx  int         // 当前轮到谁叫分
	HighestBid  int         // 当前最高叫分
	HighestIdx  int         // 最高叫分者座位号
	HighestSuit Suit        // 最高叫分者选的花色
	PassCount   int         // 连续不叫计数
	Passed      [MaxPlayers]bool // 谁已经放弃叫分
	History     []BidAction // 叫分历史
	Finished    bool        // 叫分是否结束
}

// NewBidManager 创建叫分管理器
func NewBidManager(firstIdx int) *BidManager {
	return &BidManager{
		FirstIdx:   firstIdx,
		CurrentIdx: firstIdx,
		HighestIdx: -1,
	}
}

// Bid 执行叫分动作
func (bm *BidManager) Bid(seatIdx int, score int, suit Suit) error {
	if bm.Finished {
		return errors.New("叫分已结束")
	}
	if seatIdx != bm.CurrentIdx {
		return errors.New("未轮到该玩家叫分")
	}

	if score == 0 {
		// 不叫
		return bm.pass(seatIdx)
	}

	// 校验叫分值
	if score < BidMin || score > BidMax || score%BidStep != 0 {
		return errors.New("叫分值不合法")
	}
	if score <= bm.HighestBid {
		return errors.New("叫分必须高于当前最高分")
	}
	if suit < SuitSpade || suit > SuitClub {
		return errors.New("花色不合法")
	}

	bm.HighestBid = score
	bm.HighestIdx = seatIdx
	bm.HighestSuit = suit
	bm.PassCount = 0
	bm.History = append(bm.History, BidAction{SeatIdx: seatIdx, Score: score, TrumpSuit: suit})

	// 叫到100直接结束
	if score == BidMax {
		bm.Finished = true
		return nil
	}

	bm.advance()
	return nil
}

// pass 不叫
func (bm *BidManager) pass(seatIdx int) error {
	bm.Passed[seatIdx] = true
	bm.PassCount++
	bm.History = append(bm.History, BidAction{SeatIdx: seatIdx, Score: 0})

	// 检查是否所有人都不叫
	passedCount := 0
	for i := 0; i < MaxPlayers; i++ {
		if bm.Passed[i] {
			passedCount++
		}
	}

	if bm.HighestIdx >= 0 {
		// 已有人叫分，其余人全部放弃 → 叫分结束
		// 除了最高叫分者外，其余4人都放弃
		if passedCount >= MaxPlayers-1 {
			bm.Finished = true
			return nil
		}
	} else {
		// 无人叫分，全部放弃 → 首家强制75
		if passedCount >= MaxPlayers {
			bm.HighestBid = BidMin
			bm.HighestIdx = bm.FirstIdx
			// 花色待首家选择，暂不设置
			bm.Finished = true
			return nil
		}
	}

	bm.advance()
	return nil
}

// advance 推进到下一个未放弃的玩家
func (bm *BidManager) advance() {
	for i := 0; i < MaxPlayers; i++ {
		next := NextSeat(bm.CurrentIdx)
		bm.CurrentIdx = next
		if !bm.Passed[next] && next != bm.HighestIdx {
			return
		}
		// 跳过已放弃的和当前最高叫分者（除非只剩他一人）
		if next == bm.HighestIdx {
			// 最高叫分者不需要再叫（除非循环回来且还有人没放弃）
			// 检查是否只剩最高叫分者
			activeCount := 0
			for j := 0; j < MaxPlayers; j++ {
				if !bm.Passed[j] {
					activeCount++
				}
			}
			if activeCount <= 1 {
				bm.Finished = true
				return
			}
			// 跳过最高叫分者，继续找下一个
			continue
		}
	}
}

// IsForced 是否是强制叫分（无人叫分，首家被迫）
func (bm *BidManager) IsForced() bool {
	if !bm.Finished {
		return false
	}
	// 检查历史中是否有人真正叫分
	for _, h := range bm.History {
		if h.Score > 0 {
			return false
		}
	}
	return true
}

// SetForcedSuit 为强制叫分设置花色
func (bm *BidManager) SetForcedSuit(suit Suit) error {
	if !bm.IsForced() {
		return errors.New("非强制叫分状态")
	}
	if suit < SuitSpade || suit > SuitClub {
		return errors.New("花色不合法")
	}
	bm.HighestSuit = suit
	return nil
}
