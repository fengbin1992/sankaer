package user

import (
	"go.uber.org/zap"
	"gorm.io/gorm"
	pkgMysql "sankaer/internal/pkg/mysql"
)

// GetCoins 查询余额
func GetCoins(userID string) (int64, error) {
	u, err := GetByUserID(pkgMysql.DB, userID)
	if err != nil {
		return 0, err
	}
	return u.Coins, nil
}

// AddCoins 增加金币
func AddCoins(userID string, amount int64) (int64, error) {
	if amount <= 0 {
		return 0, gorm.ErrInvalidValue
	}
	newBalance, err := UpdateCoins(pkgMysql.DB, userID, amount)
	if err != nil {
		zap.L().Error("加币失败", zap.String("userId", userID), zap.Int64("amount", amount), zap.Error(err))
	}
	return newBalance, err
}

// DeductCoins 扣除金币
func DeductCoins(userID string, amount int64) (int64, error) {
	if amount <= 0 {
		return 0, gorm.ErrInvalidValue
	}
	newBalance, err := UpdateCoins(pkgMysql.DB, userID, -amount)
	if err != nil {
		zap.L().Error("扣币失败", zap.String("userId", userID), zap.Int64("amount", amount), zap.Error(err))
	}
	return newBalance, err
}

// CheckEntryFee 检查入场金币是否足够
func CheckEntryFee(userID string, tier uint32) (bool, error) {
	minCoins := map[uint32]int64{
		10:    100,
		100:   1000,
		1000:  10000,
		10000: 100000,
	}
	required, ok := minCoins[tier]
	if !ok {
		required = 100
	}
	coins, err := GetCoins(userID)
	if err != nil {
		return false, err
	}
	return coins >= required, nil
}
