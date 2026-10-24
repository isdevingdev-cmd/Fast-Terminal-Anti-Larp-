# Fast Terminal — Anti-Larp

Terminal de trading Solana pour les trenches : rapide, non-custodial, à frais réduits, avec un scoring **LarpCheck** intégré qui note la crédibilité GitHub du développeur de chaque token avant que tu n'appuies sur *buy*.

Inspiré de la structure de [Motion](https://motion.gift/) (trenches New / Almost bonded / Migrated, presets Eco/Fast/Turbo, wallets in-browser) et des six vérifications de [LARP CHECK](https://larpcheck.live/), réimplémentés from scratch.

## Ce que fait le code aujourd'hui

| Module | État | Détails |
| --- | --- | --- |
| Flux live pump.fun | ✅ | `logsSubscribe` sur le programme pump.fun via ton RPC, décodage des événements Anchor (`CreateEvent`, `TradeEvent`, `CompleteEvent`) en local. Aucun vendeur de données tiers. |
| Trenches | ✅ | Trois colonnes, MC/vol/tx/B-S en direct, barre de bonding, flags DEV SOLD / BUNDLE / DEV %, filtres LarpCheck, pause. |
| Page token | ✅ | Chart en bougies (lightweight-charts) construit depuis les trades + backfill on-chain, flux de trades, top traders, sécurité, dev, distribution. |
| Wallet | ✅ | Keypairs générés/importés dans le navigateur, chiffrés AES-256-GCM (PBKDF2) en localStorage, export clé privée. |
| Trading | ✅ (à valider on-chain) | Provider **PumpPortal local API** (tx non signée → signature locale → envoi RPC ou Jito). Frais plateforme et tip Jito ajoutés dans la même tx. |
| Trading natif | 🧪 | `src/lib/trade/native.ts` construit directement les instructions `buy`/`sell` de pump.fun (0 intermédiaire). Non encore exercé sur mainnet : à tester avec de petits montants avant d'activer `NEXT_PUBLIC_TRADE_PROVIDER=native`. |
| LarpCheck | ✅ | `/api/larpcheck` : six checks sur l'API GitHub, score /10, tier S–F, heatmap de commits. Badge sur chaque ligne, panneau détaillé, page scanner. |
| Positions | ✅ | PnL live depuis la courbe, soldes SPL rafraîchis, ventes 25/50/100 %. TP/SL : modèle prêt, exécution automatique **à faire**. |
| Fee audit | ✅ | Page de transparence sur les frais. |

## Démarrage

```bash
pnpm install
cp .env.example .env.local   # renseigne NEXT_PUBLIC_RPC_URL (Helius conseillé) et NEXT_PUBLIC_FEE_WALLET
pnpm dev                     # http://localhost:3000
pnpm test                    # tests unitaires (décodeur, courbe, candles, scoring)
pnpm typecheck
```

Un RPC avec WebSocket est indispensable : le RPC public rate-limite `logsSubscribe`. Le plan gratuit Helius suffit pour développer.

## Architecture

```
src/
  app/                 routes Next.js (App Router)
    api/token          metadata on-chain + off-chain d'un token (liens → LarpCheck)
    api/larpcheck      scan GitHub → LarpReport
    api/trade/build    proxy PumpPortal (tx NON signée)
    api/trade/send     relais Jito pour le mode MEV protect
    api/solprice       prix SOL/USD (Jupiter, fallback CoinGecko)
  lib/
    pump/              constantes, décodeur d'événements, maths de bonding curve, metadata
    feed/              WebSocket RPC → store, chargeur de metadata, backfill d'historique
    store/             zustand : tokens (live), settings, positions, market
    wallet/            chiffrement WebCrypto + store de wallets
    trade/             TradeProvider (pumpportal | native), exécution, frais
    larpcheck/         client GitHub, faits, scoring pur, cache
    chart/             agrégation de bougies
  components/          UI (trenches, token, trade, larp, wallet, layout)
tests/                 node:test, compilés avec tsc
```

Principes : la couche `lib/pump`, `lib/chart` et `lib/larpcheck/scoring` est pure (pas de React, pas de réseau) et testée. Les clés privées ne quittent jamais le navigateur ; le serveur ne construit que des transactions non signées.

## Frais

- Frais plateforme : `NEXT_PUBLIC_PLATFORM_FEE_BPS` (50 = 0,5 %), transférés vers `NEXT_PUBLIC_FEE_WALLET` dans la transaction signée par l'utilisateur.
- pump.fun prélève 1 % sur toutes les plateformes.
- Avec le provider PumpPortal, PumpPortal prélève 0,5 % supplémentaires : c'est précisément ce que le provider natif supprime.

## Roadmap

1. Valider le provider natif sur mainnet (petits montants), puis le rendre par défaut sur la courbe ; PumpSwap natif ensuite.
2. Exécution automatique des TP/SL (worker côté client tant qu'un onglet est ouvert, comme Motion).
3. Tracker de wallets (`subscribe` sur des adresses), alertes.
4. Multi-chaînes (Base via le launchpad maison, BNB).
5. Carte de verdict LarpCheck partageable (image OG).

## Sécurité

- Non-custodial : clés chiffrées localement, jamais transmises.
- Exporte et sauvegarde la clé privée de chaque wallet : vider le stockage du navigateur la supprime.
- Le code de trading natif est expérimental. Une erreur d'instruction fait échouer la transaction (pas de perte de fonds hors frais réseau), mais teste toujours avec de petits montants.
