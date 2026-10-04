# Postiz セルフホスト環境

[Postiz](https://postiz.com/) は、複数の SNS への投稿を予約・管理できるオープンソースのソーシャルメディア管理ツールです。このリポジトリは、Postiz を公式 Docker イメージで **セルフホスト（自分で起動）** するための構成一式です。

## 構成

- **postiz** — Postiz 本体（`ghcr.io/gitroomhq/postiz-app:latest`）/ ポート `4007`
- **postiz-postgres** — PostgreSQL 17（データ保存用）
- **postiz-redis** — Redis 7.2（ジョブキュー / キャッシュ用）

データは Docker の名前付きボリュームに永続化されます。

## 必要なもの

- Docker
- Docker Compose v2（`docker compose` コマンド）

## セットアップ手順

### 1. 環境変数ファイルを作成

```bash
cp .env.example .env
```

### 2. `JWT_SECRET` を生成して設定

ランダムなシークレットを生成します。

```bash
openssl rand -base64 32
```

出力された値を `.env` の `JWT_SECRET` に設定してください。

> ⚠️ 本番環境では、`.env` の `POSTGRES_PASSWORD` も必ず強固な値に変更してください。

### 3. 起動

```bash
docker compose up -d
```

初回はイメージの取得とデータベースの初期化に少し時間がかかります。状態は次で確認できます。

```bash
docker compose ps
docker compose logs -f postiz
```

### 4. アクセス

ブラウザで以下を開きます。

```
http://localhost:4007
```

最初に表示される画面でアカウントを登録してログインします。

## よく使うコマンド

| 操作 | コマンド |
|---|---|
| 起動 | `docker compose up -d` |
| 停止 | `docker compose down` |
| ログ確認 | `docker compose logs -f postiz` |
| 再起動 | `docker compose restart postiz` |
| 最新イメージへ更新 | `docker compose pull && docker compose up -d` |
| データも含めて完全削除 | `docker compose down -v` ⚠️ ボリュームが消えます |

## 外部公開 / 本番運用する場合

1. `.env` の URL を実際のドメイン（https）に変更します。

   ```env
   MAIN_URL=https://postiz.example.com
   FRONTEND_URL=https://postiz.example.com
   NEXT_PUBLIC_BACKEND_URL=https://postiz.example.com/api
   ```

2. Postiz 本体はリバースプロキシ（Nginx / Caddy / Traefik など）の背後に置き、TLS 終端を行うことを推奨します。
3. 最初のアカウントを作成したら、`.env` の `DISABLE_REGISTRATION=true` にして再起動すると、不特定多数の登録を防げます。
4. 各 SNS（X / Mastodon / LinkedIn など）との連携は、Postiz の管理画面および各プラットフォームの開発者設定から API キーを登録して行います。

## 環境変数一覧

| 変数 | 説明 | デフォルト |
|---|---|---|
| `JWT_SECRET` | JWT 署名用シークレット（**必須・要変更**） | なし |
| `MAIN_URL` / `FRONTEND_URL` | 外部アクセス URL | `http://localhost:4007` |
| `NEXT_PUBLIC_BACKEND_URL` | バックエンド API の URL | `http://localhost:4007/api` |
| `POSTIZ_PORT` | ホスト側の公開ポート | `4007` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | DB 認証情報 | `postiz-user` / `postiz-password` / `postiz-db-local` |
| `DISABLE_REGISTRATION` | 新規登録を無効化 | `false` |

詳しい設定は [Postiz 公式ドキュメント](https://docs.postiz.com/) を参照してください。
