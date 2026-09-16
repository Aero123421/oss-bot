# oss-bot

セルフホスト向け AI エージェントチャット。オンプレ優先。

## クイックスタート

```bash
# PLACEHOLDER — 起動入口確定後に差し替え
curl -fsSL https://raw.githubusercontent.com/Aero123421/oss-bot/main/install.sh | bash
```

起動後は UI を開く（スクショ: `docs/images/onboarding-1.png` — TBD）。

1コマンドでチャットまで到達するのがゴール。失敗したら次の doctor へ。

## 失敗したら

```bash
oss-bot doctor
```

1. 落ちたチェックを確認する。
2. [Runbook §起動失敗](docs/runbook-oncall.md#startup-failure) を見る。
3. 直らなければ [doctor Issue](https://github.com/Aero123421/oss-bot/issues/new?template=doctor.yml) に **実行コマンド** と **doctor 全出力** を添付する。

## リモートアクセス

公開方法と接続断の復旧は [Remote access](docs/remote-access.md)。

## アーキテクチャ

構成の概要は [Architecture](docs/architecture.md)。

## ドキュメント

| ドキュメント | 用途 |
| --- | --- |
| [README (English)](README.md) | 英語版 |
| [Architecture](docs/architecture.md) | 構成骨子 |
| [Remote access](docs/remote-access.md) | リモート / 再接続 |
| [On-call runbook](docs/runbook-oncall.md) | 一次切り分け |

## コントリビュート

Issue テンプレ（`bug` / `feature` / `doctor`）を使う。PR は `main` 向けのみ。
