package game

// CalcRoundPoints 计算一轮出牌的分值
func CalcRoundPoints(cards [MaxPlayers]Card) int {
	total := 0
	for _, c := range cards {
		total += c.PointValue()
	}
	return total
}

// CalcBottomPoints 计算底牌分值
func CalcBottomPoints(bottom []Card) int {
	return CalcPoints(bottom)
}

// ScoreResult 计分结果
type ScoreResult struct {
	CatcherScore   int  // 抓分方总得分（含扣底）
	DealerScore    int  // 庄家方总得分
	BottomPoints   int  // 底牌分值
	BottomDoubled  bool // 是否触发扣底翻倍
}

// CalcFinalScore 计算最终得分（含底牌处理）
func CalcFinalScore(room *Room) ScoreResult {
	result := ScoreResult{
		CatcherScore: room.PointsTaken[1],
		BottomPoints: CalcBottomPoints(room.Bottom),
	}

	// 扣底：抓分方基础得分 >= 叫分时，底牌分×2计入抓分方
	if result.CatcherScore >= room.BidScore {
		result.BottomDoubled = true
		result.CatcherScore += result.BottomPoints * 2
	}

	result.DealerScore = 100 - result.CatcherScore
	if result.DealerScore < 0 {
		result.DealerScore = 0
	}

	return result
}
