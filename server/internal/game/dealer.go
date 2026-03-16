package game

import (
	"math/rand"
)

// Shuffle 使用 Fisher-Yates 算法洗牌
func Shuffle(deck []Card, rng *rand.Rand) {
	for i := len(deck) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		deck[i], deck[j] = deck[j], deck[i]
	}
}

// Deal 发牌：每人10张 + 4张底牌
// 从首家开始逆时针方向发牌
func Deal(room *Room, rng *rand.Rand) {
	deck := NewDeck()
	Shuffle(deck, rng)

	// 前50张分给5人，每人10张，从首家开始逆时针
	idx := 0
	for i := 0; i < HandSize; i++ {
		for j := 0; j < MaxPlayers; j++ {
			seat := (room.FirstIdx + j) % MaxPlayers
			room.Players[seat].Hand = append(room.Players[seat].Hand, deck[idx])
			idx++
		}
	}

	// 最后4张为底牌
	room.Bottom = make([]Card, BottomSize)
	copy(room.Bottom, deck[50:54])
}

// DetermineFirstPlayer 翻牌定首家（首局）
// 随机翻一张牌，按点数从1号位逆时针数到对应玩家
// 点数映射: 大王=15, 小王=14, K=13, ..., A=1
// mod 5 确定座位（从0号位开始数）
func DetermineFirstPlayer(rng *rand.Rand) (firstIdx int, flippedCard Card) {
	deck := NewDeck()
	Shuffle(deck, rng)
	flippedCard = deck[0]

	// 计算点数
	var pointValue int
	switch flippedCard.Rank {
	case RankJokerB:
		pointValue = 15
	case RankJokerS:
		pointValue = 14
	default:
		pointValue = int(flippedCard.Rank)
	}

	// mod 5 确定座位 (从0号位开始)
	// 点数从1号位开始数, 所以: (pointValue - 1) % 5
	firstIdx = (pointValue - 1) % MaxPlayers
	return
}
