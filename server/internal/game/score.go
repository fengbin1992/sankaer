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
	CatcherScore   int  // 抓分方总得分
	DealerScore    int  // 庄家方总得分（100 - 抓分方得分，正常情况）
	BottomPoints   int  // 底牌分值
	LastHandCatcher bool // 最后一手是否抓分方赢
}

// CalcFinalScore 计算最终得分（含底牌处理）
func CalcFinalScore(room *Room) ScoreResult {
	result := ScoreResult{
		CatcherScore:   room.PointsTaken[1],
		BottomPoints:   CalcBottomPoints(room.Bottom),
		LastHandCatcher: !room.Teams[room.LastWinnerIdx], // 最后一手赢家不是庄家方
	}

	// 底牌分值处理：抓分方赢最后一手时，底牌分×2计入抓分方
	if result.LastHandCatcher {
		result.CatcherScore += result.BottomPoints * 2
	}

	result.DealerScore = 100 - result.CatcherScore
	if result.DealerScore < 0 {
		result.DealerScore = 0
	}

	return result
}
