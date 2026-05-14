#!/usr/bin/env bash
# getoken 本地开发环境：在当前 cmux 工作区里新增左右两个 pane，分别跑后端和前端。
#
# 用法：
#   ./scripts/dev.sh            # 在当前工作区新建两个 pane 起后端/前端
#   ./scripts/dev.sh --stop     # 杀掉后端/前端进程（pane 留给用户自己关闭）
#
set -euo pipefail

BACKEND_PORT=38883
FRONTEND_PORT=38838

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
WEB_DIR="$ROOT_DIR/web"

if ! command -v cmux >/dev/null 2>&1; then
  echo "[dev] 找不到 cmux，请先安装 cmux.app" >&2
  exit 1
fi

if [[ -z "${CMUX_WORKSPACE_ID:-}" ]]; then
  echo "[dev] 当前不在 cmux 终端里（CMUX_WORKSPACE_ID 未设置），请在 cmux 工作区内运行本脚本。" >&2
  exit 1
fi

kill_port() {
  local port="$1"
  lsof -ti tcp:"$port" 2>/dev/null | xargs -r kill 2>/dev/null || true
}

stop_dev() {
  echo "[dev] 停止后端/前端进程 ..."
  kill_port "$BACKEND_PORT"
  kill_port "$FRONTEND_PORT"
  pkill -f 'cmd/getoken' 2>/dev/null || true
  pkill -f 'node .*vite' 2>/dev/null || true
  echo "[dev] 已停止。"
}

case "${1:-}" in
  --stop)
    stop_dev
    exit 0
    ;;
esac

if [[ ! -f "$SERVER_DIR/.env" ]]; then
  echo "[dev] $SERVER_DIR/.env 不存在，请先 cp .env.example .env" >&2
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  WEB_CMD="pnpm dev"
elif command -v npm >/dev/null 2>&1; then
  WEB_CMD="npm run dev"
else
  echo "[dev] 找不到 pnpm 也找不到 npm" >&2
  exit 1
fi

BACKEND_CMD="go run ./cmd/getoken"

# 启动前先把端口占用清掉，避免冲突
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

# new-split 输出形如 "OK surface:108 workspace:9"，取第二列拿到新 surface ref。
split_right() {
  local from="$1"
  local out
  if [[ -n "$from" ]]; then
    out=$(cmux new-split right --surface "$from" --focus false)
  else
    out=$(cmux new-split right --focus false)
  fi
  awk '{print $2}' <<<"$out"
}

# 从当前 pane 右侧切一个后端 pane
BACKEND_SURFACE=$(split_right "")
if [[ -z "$BACKEND_SURFACE" ]]; then
  echo "[dev] 创建后端 pane 失败" >&2
  exit 1
fi
cmux send --surface "$BACKEND_SURFACE" -- "cd '$SERVER_DIR' && echo '== backend  :$BACKEND_PORT ==' && $BACKEND_CMD\n"

# 再从后端 pane 右侧切一个前端 pane
FRONTEND_SURFACE=$(split_right "$BACKEND_SURFACE")
if [[ -z "$FRONTEND_SURFACE" ]]; then
  echo "[dev] 创建前端 pane 失败" >&2
  exit 1
fi
cmux send --surface "$FRONTEND_SURFACE" -- "cd '$WEB_DIR' && echo '== frontend :$FRONTEND_PORT ==' && $WEB_CMD\n"

cat <<INFO
[dev] 已在当前工作区起后端/前端 pane。

  后端：http://localhost:$BACKEND_PORT  ($BACKEND_SURFACE)
  前端：http://localhost:$FRONTEND_PORT  ($FRONTEND_SURFACE)

停止进程：./scripts/dev.sh --stop
关闭 pane：cmux close-surface --surface $BACKEND_SURFACE / $FRONTEND_SURFACE
INFO
