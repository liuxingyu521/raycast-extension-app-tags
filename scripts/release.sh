#!/bin/bash
# 本地发版：lint + build -> 打 tag -> 推送，GitHub Actions 接手打包 Release
# 用法：
#   npm run publish            用 package.json 当前版本号发版
#   npm run publish -- patch   先 bump 版本号（patch/minor/major 或具体 x.y.z）再发版
set -e
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ 工作区有未提交的改动，请先提交再发版"
  exit 1
fi

if [ -n "$1" ]; then
  # npm version 会自动提交并创建 vX.Y.Z 标签
  npm version "$1" -m "chore: 发布 v%s"
else
  VERSION=$(node -p "require('./package.json').version")
  TAG="v$VERSION"
  if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "✗ 标签 $TAG 已存在。请先 bump 版本号，例如：npm run publish -- patch"
    exit 1
  fi
fi

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

echo "-> lint 校验"
npm run lint
echo "-> 生产构建"
npm run build

if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  git tag -a "$TAG" -m "App Tags $VERSION"
fi

echo "-> 推送提交与标签 $TAG"
git push origin HEAD
git push origin "$TAG"

echo "✓ 已推送 $TAG，GitHub Actions 将自动打包并创建 Release"
