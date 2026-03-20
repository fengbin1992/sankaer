package user

import (
	"gorm.io/gorm"
	"time"
)

// User 用户模型
type User struct {
	ID        uint      `gorm:"primaryKey;autoIncrement"`
	UserID    string    `gorm:"column:user_id;type:varchar(32);uniqueIndex"`
	Nickname  string    `gorm:"column:nickname;type:varchar(64)"`
	Avatar    string    `gorm:"column:avatar;type:varchar(256)"`
	Phone     *string   `gorm:"column:phone;type:varchar(20);uniqueIndex"`
	WxOpenID  *string   `gorm:"column:wx_openid;type:varchar(128);uniqueIndex"`
	WxUnionID *string   `gorm:"column:wx_unionid;type:varchar(128)"`
	Password  *string   `gorm:"column:password;type:varchar(128)"`
	Coins     int64     `gorm:"column:coins;default:2000"`
	Status    int8      `gorm:"column:status;default:1"` // 1=正常 0=封禁
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (User) TableName() string {
	return "users"
}

// GetByUserID 通过 userId 查询
func GetByUserID(db *gorm.DB, userID string) (*User, error) {
	var u User
	err := db.Where("user_id = ?", userID).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// CreateUser 创建用户
func CreateUser(db *gorm.DB, u *User) error {
	return db.Create(u).Error
}

// UpdateCoins 更新金币（事务安全）
func UpdateCoins(db *gorm.DB, userID string, delta int64) (int64, error) {
	var newBalance int64
	err := db.Transaction(func(tx *gorm.DB) error {
		var u User
		if err := tx.Where("user_id = ?", userID).First(&u).Error; err != nil {
			return err
		}
		newBalance = u.Coins + delta
		if newBalance < 0 {
			return gorm.ErrInvalidValue // 金币不足
		}
		return tx.Model(&u).Update("coins", newBalance).Error
	})
	return newBalance, err
}
