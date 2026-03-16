#!/bin/bash
# scripts/proto-gen.sh
# 从 proto/ 源文件生成 Go 和 TypeScript 代码

set -e

PROTO_DIR="./proto"
GO_OUT="./server/internal/pkg/pb"
TS_OUT="./client/assets/scripts/protocol/generated"

echo "=== 清理旧文件 ==="
rm -f "$GO_OUT"/*.pb.go
rm -f "$TS_OUT"/*.ts

echo "=== 生成 Go Protobuf ==="
mkdir -p "$GO_OUT"
protoc \
    --proto_path="$PROTO_DIR" \
    --go_out="$GO_OUT" \
    --go_opt=paths=source_relative \
    "$PROTO_DIR"/*.proto

echo "=== 生成 TypeScript Protobuf ==="
mkdir -p "$TS_OUT"
npx protoc \
    --proto_path="$PROTO_DIR" \
    --ts_out="$TS_OUT" \
    --ts_opt=long_type_string \
    "$PROTO_DIR"/*.proto

echo "=== Proto 生成完成 ==="
echo "  Go:  $GO_OUT"
echo "  TS:  $TS_OUT"
