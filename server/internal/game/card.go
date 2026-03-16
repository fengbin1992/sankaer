package game

import "fmt"

// Suit 花色
type Suit int

const (
	SuitNone    Suit = 0 // 无花色（大小王）
	SuitSpade   Suit = 1 // ♠ 黑桃
	SuitHeart   Suit = 2 // ♥ 红桃
	SuitDiamond Suit = 3 // ♦ 方块
	SuitClub    Suit = 4 // ♣ 梅花
)

var suitNames = map[Suit]string{
	SuitNone:    "",
	SuitSpade:   "♠",
	SuitHeart:   "♥",
	SuitDiamond: "♦",
	SuitClub:    "♣",
}

func (s Suit) String() string { return suitNames[s] }

// Rank 点数
type Rank int

const (
	RankA     Rank = 1
	Rank2     Rank = 2
	Rank3     Rank = 3
	Rank4     Rank = 4
	Rank5     Rank = 5
	Rank6     Rank = 6
	Rank7     Rank = 7
	Rank8     Rank = 8
	Rank9     Rank = 9
	Rank10    Rank = 10
	RankJ     Rank = 11
	RankQ     Rank = 12
	RankK     Rank = 13
	RankJokerS Rank = 14 // 小王
	RankJokerB Rank = 15 // 大王
)

var rankNames = map[Rank]string{
	RankA: "A", Rank2: "2", Rank3: "3", Rank4: "4", Rank5: "5",
	Rank6: "6", Rank7: "7", Rank8: "8", Rank9: "9", Rank10: "10",
	RankJ: "J", RankQ: "Q", RankK: "K",
	RankJokerS: "小王", RankJokerB: "大王",
}

func (r Rank) String() string { return rankNames[r] }

// Card 牌面
type Card struct {
	Suit Suit
	Rank Rank
}

func (c Card) String() string {
	if c.Rank == RankJokerS {
		return "小王"
	}
	if c.Rank == RankJokerB {
		return "大王"
	}
	return fmt.Sprintf("%s%s", c.Suit, c.Rank)
}

// Equal 判断两张牌是否相同
func (c Card) Equal(o Card) bool {
	return c.Suit == o.Suit && c.Rank == o.Rank
}

// PointValue 返回牌的分值：5→5，10→10，K→10，其余→0
func (c Card) PointValue() int {
	switch c.Rank {
	case Rank5:
		return 5
	case Rank10, RankK:
		return 10
	default:
		return 0
	}
}

// IsJoker 是否为王牌
func (c Card) IsJoker() bool {
	return c.Rank == RankJokerS || c.Rank == RankJokerB
}

// IsTrump 判断是否为主牌（需要传入主花色）
// 主牌包括：大王、小王、所有花色的2、主花色的 A~K（不含2，2已是主牌）
func (c Card) IsTrump(trumpSuit Suit) bool {
	if c.IsJoker() {
		return true
	}
	if c.Rank == Rank2 {
		return true
	}
	if c.Suit == trumpSuit {
		return true
	}
	return false
}

// TrumpOrder 返回主牌的排序值（越大越强），非主牌返回 0
// 大王(18) > 小王(17) > 主2(16) > 副2(15) > 主花色 A(14) > K(13) > ... > 3(3)
func (c Card) TrumpOrder(trumpSuit Suit) int {
	if !c.IsTrump(trumpSuit) {
		return 0
	}
	if c.Rank == RankJokerB {
		return 18
	}
	if c.Rank == RankJokerS {
		return 17
	}
	if c.Rank == Rank2 {
		if c.Suit == trumpSuit {
			return 16 // 主2
		}
		return 15 // 副2
	}
	// 主花色的普通牌：A=14, K=13, Q=12, J=11, 10=10, 9=9, ... 3=3
	if c.Rank == RankA {
		return 14
	}
	return int(c.Rank)
}

// NonTrumpOrder 返回副牌花色内排序值（A=14 最大），用于同花色比较
// A > K > Q > J > 10 > 9 > ... > 3
func (c Card) NonTrumpOrder() int {
	if c.Rank == RankA {
		return 14
	}
	return int(c.Rank)
}

// CompareCards 比较两张牌大小（在一轮出牌中）
// leadSuit: 领出的花色（用于判定跟牌/垫牌）
// trumpSuit: 主花色
// 返回值: >0 表示 a 大, <0 表示 b 大, 0 表示相等
func CompareCards(a, b Card, leadSuit Suit, trumpSuit Suit) int {
	aIsTrump := a.IsTrump(trumpSuit)
	bIsTrump := b.IsTrump(trumpSuit)

	// 主牌 > 副牌
	if aIsTrump && !bIsTrump {
		return 1
	}
	if !aIsTrump && bIsTrump {
		return -1
	}

	// 都是主牌，按主牌排序比较
	if aIsTrump && bIsTrump {
		return a.TrumpOrder(trumpSuit) - b.TrumpOrder(trumpSuit)
	}

	// 都是副牌
	// 确定实际花色（领出花色的牌才有比较资格，垫牌不参与比大小）
	aFollows := cardFollowsSuit(a, leadSuit, trumpSuit)
	bFollows := cardFollowsSuit(b, leadSuit, trumpSuit)

	if aFollows && !bFollows {
		return 1 // a 跟了领出花色，b 是垫牌
	}
	if !aFollows && bFollows {
		return -1
	}
	if !aFollows && !bFollows {
		return 0 // 都是垫牌，不比大小（先出的大）
	}

	// 都跟了领出花色，按副牌大小比较
	return a.NonTrumpOrder() - b.NonTrumpOrder()
}

// cardFollowsSuit 判断副牌是否跟了领出花色
func cardFollowsSuit(c Card, leadSuit Suit, trumpSuit Suit) bool {
	if c.IsTrump(trumpSuit) {
		return false
	}
	return c.Suit == leadSuit
}

// NewDeck 生成完整 54 张牌组
func NewDeck() []Card {
	deck := make([]Card, 0, 54)
	suits := []Suit{SuitSpade, SuitHeart, SuitDiamond, SuitClub}
	for _, s := range suits {
		for r := RankA; r <= RankK; r++ {
			deck = append(deck, Card{Suit: s, Rank: r})
		}
	}
	deck = append(deck, Card{Suit: SuitNone, Rank: RankJokerS})
	deck = append(deck, Card{Suit: SuitNone, Rank: RankJokerB})
	return deck
}

// CardsContain 检查牌组中是否包含指定牌
func CardsContain(cards []Card, target Card) bool {
	for _, c := range cards {
		if c.Equal(target) {
			return true
		}
	}
	return false
}

// CardsRemove 从牌组中移除一张牌，返回移除后的牌组和是否成功
func CardsRemove(cards []Card, target Card) ([]Card, bool) {
	for i, c := range cards {
		if c.Equal(target) {
			return append(cards[:i], cards[i+1:]...), true
		}
	}
	return cards, false
}

// CalcPoints 计算一组牌的总分值
func CalcPoints(cards []Card) int {
	total := 0
	for _, c := range cards {
		total += c.PointValue()
	}
	return total
}
