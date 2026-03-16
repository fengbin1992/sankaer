package game

import (
	"fmt"
	"testing"
)

func TestPlayCard_ValidateFollow(t *testing.T) {
	// 构建一个出牌场景
	room := NewRoom("test")
	room.State = StatePlaying
	room.TrumpSuit = SuitSpade
	room.LeadIdx = 0
	room.CurrentRound = 0

	// 初始化5个玩家
	for i := 0; i < MaxPlayers; i++ {
		room.Players[i] = &Player{
			ID:      fmt.Sprintf("p%d", i),
			SeatIdx: i,
			Online:  true,
		}
	}

	// 玩家0（领出者）出 ♥A
	room.Players[0].Hand = []Card{{SuitHeart, RankA}}
	room.Players[1].Hand = []Card{{SuitHeart, Rank3}, {SuitDiamond, RankK}}
	room.Players[2].Hand = []Card{{SuitDiamond, Rank5}} // 无红桃
	room.Players[3].Hand = []Card{{SuitSpade, Rank3}}   // 只有主牌
	room.Players[4].Hand = []Card{{SuitClub, Rank7}}     // 无红桃无主牌

	// 玩家0领出♥A
	err := PlayCard(room, 0, Card{SuitHeart, RankA})
	if err != nil {
		t.Fatalf("领出失败: %v", err)
	}

	// 玩家1有♥3必须跟红桃
	err = PlayCard(room, 1, Card{SuitDiamond, RankK})
	if err == nil {
		t.Error("有同花色时不应该允许出其他花色")
	}

	// 玩家1跟♥3
	err = PlayCard(room, 1, Card{SuitHeart, Rank3})
	if err != nil {
		t.Fatalf("跟牌失败: %v", err)
	}

	// 玩家2无红桃，可出任意牌（垫牌）
	err = PlayCard(room, 2, Card{SuitDiamond, Rank5})
	if err != nil {
		t.Fatalf("垫牌失败: %v", err)
	}

	// 玩家3无红桃，出主牌杀牌
	err = PlayCard(room, 3, Card{SuitSpade, Rank3})
	if err != nil {
		t.Fatalf("杀牌失败: %v", err)
	}

	// 玩家4垫牌
	err = PlayCard(room, 4, Card{SuitClub, Rank7})
	if err != nil {
		t.Fatalf("垫牌失败: %v", err)
	}

	// 本轮结束，主牌♠3应赢（杀牌）
	if room.LastWinnerIdx != 3 {
		t.Errorf("赢家应为玩家3(杀牌)，got %d", room.LastWinnerIdx)
	}
}

func TestPlayCard_TrumpFollow(t *testing.T) {
	room := NewRoom("test")
	room.State = StatePlaying
	room.TrumpSuit = SuitSpade
	room.LeadIdx = 0

	for i := 0; i < MaxPlayers; i++ {
		room.Players[i] = &Player{
			ID:      fmt.Sprintf("p%d", i),
			SeatIdx: i,
			Online:  true,
		}
	}

	// 玩家0领出主牌
	room.Players[0].Hand = []Card{{SuitSpade, RankA}}
	room.Players[1].Hand = []Card{{SuitSpade, Rank3}, {SuitHeart, RankK}}

	// 玩家0出主牌♠A
	if err := PlayCard(room, 0, Card{SuitSpade, RankA}); err != nil {
		t.Fatal(err)
	}

	// 玩家1有主牌♠3，必须跟主牌，不能出♥K
	err := PlayCard(room, 1, Card{SuitHeart, RankK})
	if err == nil {
		t.Error("有主牌时必须跟主牌")
	}
}

func TestRoundWinner(t *testing.T) {
	room := NewRoom("test")
	room.State = StatePlaying
	room.TrumpSuit = SuitSpade
	room.LeadIdx = 0
	room.Teams = [MaxPlayers]bool{true, false, false, false, true} // 0,4庄家方

	for i := 0; i < MaxPlayers; i++ {
		room.Players[i] = &Player{
			ID:      fmt.Sprintf("p%d", i),
			SeatIdx: i,
			Online:  true,
			Hand: []Card{
				{SuitHeart, Rank3 + Rank(i)}, // 每人一张不同点数
			},
		}
	}

	// 玩家0出♥3
	room.Players[0].Hand = []Card{{SuitHeart, Rank3}}
	room.Players[1].Hand = []Card{{SuitHeart, Rank5}}  // 5分
	room.Players[2].Hand = []Card{{SuitHeart, RankK}}   // 10分，最大
	room.Players[3].Hand = []Card{{SuitHeart, Rank7}}
	room.Players[4].Hand = []Card{{SuitHeart, Rank9}}

	for i := 0; i < MaxPlayers; i++ {
		if err := PlayCard(room, i, room.Players[i].Hand[0]); err != nil {
			t.Fatalf("玩家%d出牌失败: %v", i, err)
		}
	}

	// ♥K 最大，玩家2赢
	if room.LastWinnerIdx != 2 {
		t.Errorf("赢家应为玩家2(♥K)，got %d", room.LastWinnerIdx)
	}

	// 本轮分值：5(♥5) + 10(♥K) = 15分，归抓分方
	if room.PointsTaken[1] != 15 {
		t.Errorf("抓分方应得15分，got %d", room.PointsTaken[1])
	}
}
