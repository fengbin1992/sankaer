package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"
	"sankaer/internal/pkg/config"
	"sankaer/internal/pkg/logger"
	pkgRedis "sankaer/internal/pkg/redis"
	pkgMysql "sankaer/internal/pkg/mysql"
)

func main() {
	configPath := flag.String("config", "configs/user.yaml", "配置文件路径")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}

	if err := logger.Init(cfg.Log.Level, cfg.Log.Output); err != nil {
		fmt.Fprintf(os.Stderr, "初始化日志失败: %v\n", err)
		os.Exit(1)
	}

	if err := pkgRedis.Init(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB); err != nil {
		zap.L().Fatal("Redis 连接失败", zap.Error(err))
	}
	defer pkgRedis.Close()

	if err := pkgMysql.Init(cfg.MySQL.DSN, cfg.MySQL.MaxOpenConns, cfg.MySQL.MaxIdleConns); err != nil {
		zap.L().Fatal("MySQL 连接失败", zap.Error(err))
	}
	defer pkgMysql.Close()

	zap.L().Info("用户服务启动", zap.Int("port", cfg.Server.Port))

	// TODO: 启动用户服务（HTTP + gRPC）
	// user.NewService(cfg).Start()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zap.L().Info("用户服务正在关闭...")
}
