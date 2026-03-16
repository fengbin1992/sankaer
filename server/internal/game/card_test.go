package game

import (
	"testing"
)

func TestNewDeck(t *testing.T) {
	deck := NewDeck()
	if len(deck) != 54 {
		t.Fatalf("expected 54 cards, got %d", len(deck))
	}
	// 验证4花色×13点 + 2王
	suitCount := map[Suit]int{}
	for _, c := range deck {
		suitCount[c.Suit]++
	}
	for _, s := range []Suit{SuitSpade, SuitHeart, SuitDiamond, SuitClub} {
		if suitCount[s] != 13 {
			t.Errorf("suit %v should have 13 cards, got %d", s, suitCount[s])
		}
	}
	if suitCount[SuitNone] != 2 {
		t.Errorf("jokers should be 2, got %d", suitCount[SuitNone])
	}
}

func TestPointValue(t *testing.T) {
	tests := []struct {
		card Card
		want int
	}{
		{Card{SuitSpade, Rank5}, 5},
		{Card{SuitHeart, Rank5}, 5},
		{Card{SuitSpade, Rank10}, 10},
		{Card{SuitDiamond, Rank10}, 10},
		{Card{SuitClub, RankK}, 10},
		{Card{SuitSpade, RankK}, 10},
		{Card{SuitSpade, RankA}, 0},
		{Card{SuitHeart, Rank2}, 0},
		{Card{SuitSpade, RankQ}, 0},
		{Card{SuitSpade, RankJ}, 0},
		{Card{SuitNone, RankJokerB}, 0},
		{Card{SuitNone, RankJokerS}, 0},
	}
	for _, tt := range tests {
		got := tt.card.PointValue()
		if got != tt.want {
			t.Errorf("%v.PointValue() = %d, want %d", tt.card, got, tt.want)
		}
	}
}

func TestTotalDeckPoints(t *testing.T) {
	deck := NewDeck()
	total := CalcPoints(deck)
	if total != 100 {
		t.Fatalf("total deck points should be 100, got %d", total)
	}
}

func TestIsTrump(t *testing.T) {
	trumpSuit := SuitSpade
	tests := []struct {
		card Card
		want bool
	}{
		{Card{SuitNone, RankJokerB}, true},   // 大王
		{Card{SuitNone, RankJokerS}, true},   // 小王
		{Card{SuitSpade, Rank2}, true},        // 主2
		{Card{SuitHeart, Rank2}, true},        // 副2
		{Card{SuitDiamond, Rank2}, true},      // 副2
		{Card{SuitClub, Rank2}, true},         // 副2
		{Card{SuitSpade, RankA}, true},        // 主花色A
		{Card{SuitSpade, Rank3}, true},        // 主花色3
		{Card{SuitHeart, RankA}, false},       // 副牌
		{Card{SuitDiamond, RankK}, false},     // 副牌
	}
	for _, tt := range tests {
		got := tt.card.IsTrump(trumpSuit)
		if got != tt.want {
			t.Errorf("%v.IsTrump(%v) = %v, want %v", tt.card, trumpSuit, got, tt.want)
		}
	}
}

func TestTrumpOrder(t *testing.T) {
	trumpSuit := SuitSpade
	// 大王 > 小王 > 主2 > 副2 > 主花色A > K > ... > 3

	// 验证 A 在主牌排序中应为14（最大普通主牌）
	aOrder := Card{SuitSpade, RankA}.TrumpOrder(trumpSuit)
	if aOrder != 14 {
		t.Errorf("A TrumpOrder should be 14, got %d", aOrder)
	}
	kOrder := Card{SuitSpade, RankK}.TrumpOrder(trumpSuit)
	if aOrder <= kOrder {
		t.Error("主花色A应大于主花色K")
	}

	// 核心排序验证
	bigJoker := Card{SuitNone, RankJokerB}
	smallJoker := Card{SuitNone, RankJokerS}
	trump2 := Card{SuitSpade, Rank2}
	sub2 := Card{SuitHeart, Rank2}

	if bigJoker.TrumpOrder(trumpSuit) <= smallJoker.TrumpOrder(trumpSuit) {
		t.Error("大王应大于小王")
	}
	if smallJoker.TrumpOrder(trumpSuit) <= trump2.TrumpOrder(trumpSuit) {
		t.Error("小王应大于主2")
	}
	if trump2.TrumpOrder(trumpSuit) <= sub2.TrumpOrder(trumpSuit) {
		t.Error("主2应大于副2")
	}
}

func TestCompareCards_TrumpVsNonTrump(t *testing.T) {
	trumpSuit := SuitSpade
	leadSuit := SuitHeart

	// 任意主牌 > 任意副牌
	trump := Card{SuitSpade, Rank3} // 最小主牌
	nonTrump := Card{SuitHeart, RankA} // 最大副牌

	result := CompareCards(trump, nonTrump, leadSuit, trumpSuit)
	if result <= 0 {
		t.Error("主牌应大于副牌")
	}
}

func TestCompareCards_SameSuitNonTrump(t *testing.T) {
	trumpSuit := SuitSpade
	leadSuit := SuitHeart

	a := Card{SuitHeart, RankA}
	k := Card{SuitHeart, RankK}

	result := CompareCards(a, k, leadSuit, trumpSuit)
	if result <= 0 {
		t.Error("A应大于K")
	}
}

func TestCompareCards_DifferentSuitNonTrump(t *testing.T) {
	trumpSuit := SuitSpade
	leadSuit := SuitHeart

	follow := Card{SuitHeart, Rank3}    // 跟了领出花色
	discard := Card{SuitDiamond, RankA}  // 垫牌

	result := CompareCards(follow, discard, leadSuit, trumpSuit)
	if result <= 0 {
		t.Error("跟牌应大于垫牌")
	}
}

func TestCardsRemove(t *testing.T) {
	cards := []Card{
		{SuitSpade, RankA},
		{SuitHeart, RankK},
		{SuitDiamond, Rank5},
	}
	result, ok := CardsRemove(cards, Card{SuitHeart, RankK})
	if !ok {
		t.Fatal("should remove successfully")
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 cards, got %d", len(result))
	}
	if CardsContain(result, Card{SuitHeart, RankK}) {
		t.Error("should not contain removed card")
	}
}
