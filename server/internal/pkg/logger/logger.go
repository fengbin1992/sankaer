package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func Init(level string, output string) error {
	var zapLevel zapcore.Level
	if err := zapLevel.UnmarshalText([]byte(level)); err != nil {
		zapLevel = zapcore.InfoLevel
	}

	var cfg zap.Config
	if output == "stdout" {
		cfg = zap.NewDevelopmentConfig()
	} else {
		cfg = zap.NewProductionConfig()
		cfg.OutputPaths = []string{output}
	}
	cfg.Level = zap.NewAtomicLevelAt(zapLevel)

	l, err := cfg.Build()
	if err != nil {
		return err
	}

	zap.ReplaceGlobals(l)
	return nil
}
