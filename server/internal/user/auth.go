package user

import (
	"crypto/rand"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
	"gorm.io/gorm"
	pkgMysql "sankaer/internal/pkg/mysql"
)

// GenerateUserID 生成唯一用户 ID
func GenerateUserID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("u_%x", b)
}

// GenerateJWT 签发 JWT Token
func GenerateJWT(userID string, secret string, expire time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(expire).Unix(),
		"iat":     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GuestLogin 游客登录：通过设备 ID 查找或创建用户
func GuestLogin(deviceID string, jwtSecret string, jwtExpire time.Duration) (user *User, token string, err error) {
	db := pkgMysql.DB

	// 用 deviceID 作为简单的游客标识
	guestUserID := "guest_" + deviceID

	user, err = GetByUserID(db, guestUserID)
	if err == gorm.ErrRecordNotFound {
		// 新用户
		user = &User{
			UserID:   guestUserID,
			Nickname: generateNickname(),
			Avatar:   "",
			Coins:    2000,
			Status:   1,
		}
		if err = CreateUser(db, user); err != nil {
			zap.L().Error("创建游客用户失败", zap.Error(err))
			return nil, "", err
		}
		zap.L().Info("新游客注册", zap.String("userId", user.UserID))
	} else if err != nil {
		return nil, "", err
	}

	// 签发 JWT
	token, err = GenerateJWT(user.UserID, jwtSecret, jwtExpire)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

// generateNickname 生成随机昵称
func generateNickname() string {
	adjectives := []string{"快乐的", "勇敢的", "聪明的", "可爱的", "帅气的"}
	nouns := []string{"扑克王", "牌神", "高手", "大师", "赢家"}
	b := make([]byte, 2)
	rand.Read(b)
	adj := adjectives[int(b[0])%len(adjectives)]
	noun := nouns[int(b[1])%len(nouns)]
	return adj + noun
}
