package game

import (
	"fmt"
	"math/rand"
	"testing"
)

// TestFullGameFlow 模拟完整5人对局
func TestFullGameFlow(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	room := NewRoom("integration-test")

	// 1. 5人加入并准备
	for i := 0; i < MaxPlayers; i++ {
		seat, err := room.Join(fmt.Sprintf("player%d", i))
		if err != nil {
			t.Fatalf("玩家%d加入失败: %v", i, err)
		}
		if seat != i {
			t.Fatalf("预期座位%d，得到%d", i, seat)
		}
	}
	for i := 0; i < MaxPlayers; i++ {
		if err := room.SetReady(fmt.Sprintf("player%d", i), true); err != nil {
			t.Fatalf("玩家%d准备失败: %v", i, err)
		}
	}
	if !room.AllReady() {
		t.Fatal("5人应全部就绪")
	}

	// 2. 开局
	if err := room.StartGame(); err != nil {
		t.Fatal(err)
	}
	if room.State != StateFlipping {
		t.Fatalf("首局应进入翻牌状态，当前: %v", room.State)
	}

	// 3. 翻牌定首家
	firstIdx, flipped := DetermineFirstPlayer(rng)
	room.FirstIdx = firstIdx
	t.Logf("翻牌: %v, 首家: 座位%d", flipped, firstIdx)

	// 状态转移到发牌
	if err := room.transit(StateDealing); err != nil {
		t.Fatal(err)
	}

	// 4. 发牌
	Deal(room, rng)
	for i := 0; i < MaxPlayers; i++ {
		if len(room.Players[i].Hand) != HandSize {
			t.Fatalf("玩家%d应有%d张手牌，实际%d张", i, HandSize, len(room.Players[i].Hand))
		}
	}
	if len(room.Bottom) != BottomSize {
		t.Fatalf("底牌应有%d张，实际%d张", BottomSize, len(room.Bottom))
	}
	t.Logf("底牌: %v", room.Bottom)

	// 验证总共54张牌
	totalCards := 0
	for i := 0; i < MaxPlayers; i++ {
		totalCards += len(room.Players[i].Hand)
	}
	totalCards += len(room.Bottom)
	if totalCards != 54 {
		t.Fatalf("总牌数应为54，实际%d", totalCards)
	}

	// 5. 叫分
	if err := room.transit(StateBidding); err != nil {
		t.Fatal(err)
	}
	room.BidManager = NewBidManager(room.FirstIdx)

	// 模拟叫分：首家叫75♠，其余人不叫
	room.BidManager.Bid(room.FirstIdx, 75, SuitSpade)
	for i := 1; i < MaxPlayers; i++ {
		seat := (room.FirstIdx + i) % MaxPlayers
		room.BidManager.Bid(seat, 0, SuitNone)
	}

	if !room.BidManager.Finished {
		t.Fatal("叫分应已结束")
	}

	room.DealerIdx = room.BidManager.HighestIdx
	room.BidScore = room.BidManager.HighestBid
	room.TrumpSuit = room.BidManager.HighestSuit
	t.Logf("庄家: 座位%d, 叫分: %d, 主花色: %v", room.DealerIdx, room.BidScore, room.TrumpSuit)

	// 6. 扣底
	if err := room.transit(StateBottom); err != nil {
		t.Fatal(err)
	}
	GiveBottomToDealer(room)
	dealer := room.GetPlayer(room.DealerIdx)
	if len(dealer.Hand) != HandSize+BottomSize {
		t.Fatalf("庄家应有14张牌，实际%d", len(dealer.Hand))
	}

	// 庄家扣前4张
	discards := make([]Card, BottomSize)
	copy(discards, dealer.Hand[:BottomSize])
	if err := HandleBottom(room, discards); err != nil {
		t.Fatalf("扣底失败: %v", err)
	}
	if len(dealer.Hand) != HandSize {
		t.Fatalf("扣底后庄家应有10张牌，实际%d", len(dealer.Hand))
	}

	// 7. 叫搭档
	if err := room.transit(StateCalling); err != nil {
		t.Fatal(err)
	}

	// 找一张不在庄家手中的牌作为搭档牌
	var partnerCard Card
	found := false
	for _, s := range []Suit{SuitHeart, SuitDiamond, SuitClub} {
		c := Card{Suit: s, Rank: RankA}
		if !CardsContain(dealer.Hand, c) {
			partnerCard = c
			found = true
			break
		}
	}
	if !found {
		// 叫自己
		partnerCard = dealer.Hand[0]
	}

	if err := CallPartner(room, partnerCard); err != nil {
		t.Fatalf("叫搭档失败: %v", err)
	}
	t.Logf("搭档牌: %v, 搭档: 座位%d, 1v4: %v", partnerCard, room.PartnerIdx, room.IsSolo)

	// 8. 出牌 (10轮)
	if err := room.transit(StatePlaying); err != nil {
		t.Fatal(err)
	}
	room.LeadIdx = room.DealerIdx // 庄家先出

	for round := 0; round < TotalRounds; round++ {
		for play := 0; play < MaxPlayers; play++ {
			seat := GetCurrentPlaySeat(room)
			if seat < 0 {
				t.Fatalf("轮次%d第%d次出牌，找不到出牌玩家", round, play)
			}

			player := room.GetPlayer(seat)
			// 找第一张合法牌
			var cardToPlay Card
			played := false
			for _, c := range player.Hand {
				if ValidateFollow(room, seat, c) == nil {
					cardToPlay = c
					played = true
					break
				}
			}
			if !played {
				t.Fatalf("轮次%d，玩家%d找不到合法牌", round, seat)
			}

			if err := PlayCard(room, seat, cardToPlay); err != nil {
				t.Fatalf("轮次%d，玩家%d出%v失败: %v", round, seat, cardToPlay, err)
			}
		}
		t.Logf("轮次%d: 赢家=座位%d", round, room.LastWinnerIdx)
	}

	// 9. 验证手牌全部出完
	for i := 0; i < MaxPlayers; i++ {
		if len(room.Players[i].Hand) != 0 {
			t.Errorf("玩家%d应无手牌，剩余%d张", i, len(room.Players[i].Hand))
		}
	}

	// 10. 结算
	result := Settle(room, 10) // 10倍场
	t.Logf("抓分方得分: %d, 叫分: %d, 抓分方赢: %v", result.CatcherScore, result.BidScore, result.CatcherWin)
	t.Logf("特殊倍数: %d, 清零: %v, 关底: %v", result.SpecialMulti, result.IsZeroClear, result.IsLastHandBonus)

	for i := 0; i < MaxPlayers; i++ {
		teamStr := "抓分方"
		if room.Teams[i] {
			teamStr = "庄家方"
		}
		t.Logf("玩家%d(%s): %+d 金币", i, teamStr, result.PlayerCoins[i])
	}

	// 验证零和
	if !VerifyZeroSum(result.PlayerCoins) {
		sum := 0
		for _, c := range result.PlayerCoins {
			sum += c
		}
		t.Fatalf("结算不是零和！总和=%d", sum)
	}

	t.Log("✓ 完整对局流程测试通过")
}
