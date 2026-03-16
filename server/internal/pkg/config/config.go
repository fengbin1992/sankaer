package config

import (
	"github.com/spf13/viper"
	"go.uber.org/zap"
)

type ServerConfig struct {
	Port           int `mapstructure:"port"`
	MaxConnections int `mapstructure:"max_connections"`
	MaxRooms       int `mapstructure:"max_rooms"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type MySQLConfig struct {
	DSN          string `mapstructure:"dsn"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
}

type NatsConfig struct {
	Addr string `mapstructure:"addr"`
}

type JWTConfig struct {
	Secret string `mapstructure:"secret"`
	Expire string `mapstructure:"expire"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Output string `mapstructure:"output"`
}

type AppConfig struct {
	Server ServerConfig `mapstructure:"server"`
	Redis  RedisConfig  `mapstructure:"redis"`
	MySQL  MySQLConfig  `mapstructure:"mysql"`
	Nats   NatsConfig   `mapstructure:"nats"`
	JWT    JWTConfig    `mapstructure:"jwt"`
	Log    LogConfig    `mapstructure:"log"`
}

func Load(configPath string) (*AppConfig, error) {
	viper.SetConfigFile(configPath)
	viper.SetConfigType("yaml")

	if err := viper.ReadInConfig(); err != nil {
		return nil, err
	}

	var cfg AppConfig
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	zap.L().Info("config loaded", zap.String("path", configPath))
	return &cfg, nil
}
