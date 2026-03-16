package game

import "testing"

// 辅助函数：创建一个已设好阵营的房间用于测试结算
func makeSettleRoom(bidScore int, isSolo bool, dealerIdx, partnerIdx int) *Room {
	room := NewRoom("test-settle")
	room.BidScore = bidScore
	room.IsSolo = isSolo
	room.DealerIdx = dealerIdx
	room.PartnerIdx = partnerIdx
	room.TrumpSuit = SuitSpade

	for i := 0; i < MaxPlayers; i++ {
		room.Players[i] = &Player{ID: "p", SeatIdx: i, Online: true}
	}

	// 设置阵营
	room.SetTeams()
	return room
}

func TestSettle_DealerWin_2v3(t *testing.T) {
	room := makeSettleRoom(75, false, 0, 1)
	room.PointsTaken = [2]int{0, 50} // 抓分方50 < 75 → 庄家方赢
	room.LastWinnerIdx = 0            // 庄家赢最后一手
	room.Bottom = []Card{{SuitHeart, Rank3}, {SuitDiamond, Rank4}, {SuitClub, Rank6}, {SuitSpade, Rank7}}

	result := Settle(room, 10)

	if result.CatcherWin {
		t.Error("庄家方应赢")
	}

	// 基础分10, 场次倍率10, 无特殊倍数
	// 庄家: +10*10*2 = +200
	// 暗家: +10*10*1 = +100
	// 抓分方: -10*10*1 = -100 × 3 = -300
	if result.PlayerCoins[0] != 200 {
		t.Errorf("庄家应赢200, got %d", result.PlayerCoins[0])
	}
	if result.PlayerCoins[1] != 100 {
		t.Errorf("暗家应赢100, got %d", result.PlayerCoins[1])
	}
	for i := 2; i < MaxPlayers; i++ {
		if result.PlayerCoins[i] != -100 {
			t.Errorf("抓分方玩家%d应输100, got %d", i, result.PlayerCoins[i])
		}
	}

	if !VerifyZeroSum(result.PlayerCoins) {
		t.Error("结算不是零和")
	}
}

func TestSettle_CatcherWin(t *testing.T) {
	room := makeSettleRoom(80, false, 0, 1)
	room.PointsTaken = [2]int{0, 80} // 抓分方80 >= 80 → 抓分方赢
	room.LastWinnerIdx = 0            // 庄家赢最后一手（不触发关底）
	room.Bottom = []Card{{SuitHeart, Rank3}, {SuitDiamond, Rank4}, {SuitClub, Rank6}, {SuitSpade, Rank7}}

	result := Settle(room, 100)

	if !result.CatcherWin {
		t.Error("抓分方应赢")
	}

	// 基础分30, 场次倍率100
	// 抓分方: +30*100*1 = +3000 × 3
	// 庄家: -30*100*2 = -6000
	// 暗家: -30*100*1 = -3000
	if result.PlayerCoins[0] != -6000 {
		t.Errorf("庄家应输6000, got %d", result.PlayerCoins[0])
	}
	if result.PlayerCoins[1] != -3000 {
		t.Errorf("暗家应输3000, got %d", result.PlayerCoins[1])
	}
	for i := 2; i < MaxPlayers; i++ {
		if result.PlayerCoins[i] != 3000 {
			t.Errorf("抓分方玩家%d应赢3000, got %d", i, result.PlayerCoins[i])
		}
	}

	if !VerifyZeroSum(result.PlayerCoins) {
		t.Error("结算不是零和")
	}
}

func TestSettle_ZeroClear(t *testing.T) {
	room := makeSettleRoom(75, false, 0, 1)
	room.PointsTaken = [2]int{0, 0} // 抓分方0分 → 清零双倍
	room.LastWinnerIdx = 0
	room.Bottom = []Card{{SuitHeart, Rank3}, {SuitDiamond, Rank4}, {SuitClub, Rank6}, {SuitSpade, Rank7}}

	result := Settle(room, 10)

	if result.CatcherWin {
		t.Error("庄家方应赢")
	}
	if !result.IsZeroClear {
		t.Error("应触发清零双倍")
	}
	if result.SpecialMulti != 2 {
		t.Errorf("特殊倍数应为2, got %d", result.SpecialMulti)
	}

	// 基础分10*2=20, 场次10
	// 庄家: +20*10*2 = +400
	if result.PlayerCoins[0] != 400 {
		t.Errorf("庄家应赢400, got %d", result.PlayerCoins[0])
	}

	if !VerifyZeroSum(result.PlayerCoins) {
		t.Error("结算不是零和")
	}
}

func TestSettle_LastHandBonus(t *testing.T) {
	room := makeSettleRoom(90, false, 0, 1)
	room.PointsTaken = [2]int{0, 85} // 抓分方85 < 90
	room.LastWinnerIdx = 2            // 抓分方赢最后一手 → 关底
	room.Bottom = []Card{
		{SuitHeart, Rank10},  // 10分
		{SuitDiamond, RankK}, // 10分
		{SuitClub, Rank6},    // 0
		{SuitSpade, Rank7},   // 0
	} // 底牌20分

	result := Settle(room, 10)

	// 抓分方得分 = 85 + 20*2 = 125 >= 90 → 抓分方赢
	if !result.CatcherWin {
		t.Error("抓分方应赢（底牌翻倍后逆转）")
	}
	if !result.IsLastHandBonus {
		t.Error("应触发关底双倍")
	}
	if result.SpecialMulti != 2 {
		t.Errorf("特殊倍数应为2, got %d", result.SpecialMulti)
	}

	if !VerifyZeroSum(result.PlayerCoins) {
		t.Error("结算不是零和")
	}
}

func TestSettle_ZeroClearAndLastHand(t *testing.T) {
	// 极端情况：清零+关底叠加 → ×4
	// 这种情况实际不太可能：抓分方0分但赢了最后一手
	// 但规则上允许：抓分方赢最后一手但那手没有分值牌
	room := makeSettleRoom(75, false, 0, 1)
	room.PointsTaken = [2]int{0, 0}
	room.LastWinnerIdx = 2 // 抓分方赢最后一手
	room.Bottom = []Card{
		{SuitHeart, Rank3},
		{SuitDiamond, Rank4},
		{SuitClub, Rank6},
		{SuitSpade, Rank7},
	} // 底牌0分

	result := Settle(room, 10)

	// 抓分方得分 = 0 + 0*2 = 0 < 75 → 庄家赢
	// 清零双倍 + 关底双倍 = ×4
	if result.CatcherWin {
		t.Error("庄家方应赢")
	}
	if result.SpecialMulti != 4 {
		t.Errorf("特殊倍数应为4, got %d", result.SpecialMulti)
	}

	// 基础分10*4=40, 场次10
	// 庄家: +40*10*2 = +800
	if result.PlayerCoins[0] != 800 {
		t.Errorf("庄家应赢800, got %d", result.PlayerCoins[0])
	}

	if !VerifyZeroSum(result.PlayerCoins) {
		t.Error("结算不是零和")
	}
}

func TestSettle_Solo_1v4(t *testing.T) {
	room := makeSettleRoom(75, true, 0, 0) // 叫自己
	room.PointsTaken = [2]int{0, 50}       // 抓分方50 < 75 → 庄家赢
	room.LastWinnerIdx = 0
	room.Bottom = []Card{{SuitHeart, Rank3}, {SuitDiamond, Rank4}, {SuitClub, Rank6}, {SuitSpade, Rank7}}

	result := Settle(room, 10)

	if result.CatcherWin {
		t.Error("庄家方应赢")
	}

	// 庄家: +10*10*4 = +400
	if result.PlayerCoins[0] != 400 {
		t.Errorf("庄家应赢400, got %d", result.PlayerCoins[0])
	}
	// 抓分方各: -10*10*1 = -100
	for i := 1; i < MaxPlayers; i++ {
		if result.PlayerCoins[i] != -100 {
			t.Errorf("抓分方玩家%d应输100, got %d", i, result.PlayerCoins[i])
		}
	}

	if !VerifyZeroSum(result.PlayerCoins) {
		t.Error("结算不是零和")
	}
}

func TestSettle_Abandoned(t *testing.T) {
	room := makeSettleRoom(75, false, 0, 1)
	room.IsAbandoned = true
	room.Bottom = []Card{{SuitHeart, Rank3}, {SuitDiamond, Rank4}, {SuitClub, Rank6}, {SuitSpade, Rank7}}

	result := Settle(room, 10)

	// 庄家输一半: 正常2份=200 → 一半=100
	if result.PlayerCoins[0] != -100 {
		t.Errorf("庄家应输100, got %d", result.PlayerCoins[0])
	}
	// 搭档输一半: 正常1份=100 → 一半=50
	if result.PlayerCoins[1] != -50 {
		t.Errorf("搭档应输50, got %d", result.PlayerCoins[1])
	}

	if !VerifyZeroSum(result.PlayerCoins) {
		t.Error("结算不是零和")
	}
}
