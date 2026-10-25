# Fast Terminal — Anti-Larp

Terminal de trading Solana pour les trenches : rapide, non-custodial, **0 % de frais plateforme**, avec un scoring **LarpCheck** intégré qui note la crédibilité GitHub du développeur de chaque token avant que tu n'appuies sur *buy*.

Fork fonctionnel de [Motion](https://motion.gift/) (structure trenches, presets Eco/Fast/Turbo, wallets in-browser, routage pump.fun/PumpSwap), reconstruit avec l'accord de son auteur à partir du site et du moteur public [motion-vault](https://github.com/motiongift/motion-vault) ; six vérifications de [LARP CHECK](https://larpcheck.live/) réimplémentées.

## Ce que fait le code aujourd'hui

| Module | État | Détails |
| --- | --- | --- |
| Flux live pump.fun | ✅ | `logsSubscribe` sur le programme pump.fun via ton RPC, décodage des événements Anchor (`CreateEvent`, `TradeEvent`, `CompleteEvent`) en local. Aucun vendeur de données tiers. |
| Trenches | ✅ | Trois colonnes, MC/vol/tx/B-S en direct, barre de bonding, flags DEV SOLD / BUNDLE / DEV % / MAYHEM, âge on-chain, pause. |
| Page token | ✅ | Chart en bougies (lightweight-charts) construit depuis les trades + backfill on-chain, flux de trades, top traders, sécurité, dev, distribution. |
| Wallet | ✅ | Keypairs générés/importés dans le navigateur, chiffrés AES-256-GCM (PBKDF2) en localStorage, export clé privée. |
| Trading natif (courbe) | ✅ simulé mainnet | `src/lib/trade/native.ts` construit `buy_exact_quote_in_v3` / `sell_v3` de pump.fun en local (0 intermédiaire). Buy et sell simulés avec succès sur mainnet le 2026-10-25 (`docs/pump-v3.md`). Signature locale, frais plateforme + tip Jito dans la même tx. |
| Trading après migration | ✅ simulé mainnet | PumpSwap natif (`src/lib/trade/pumpRouter.ts`) : pool canonique dérivé du mint, quote avec les paliers de frais on-chain, wSOL wrap/unwrap. Buy et sell simulés OK. PumpPortal uniquement en repli. |
| Filtres | ✅ | Par colonne (MC, âge, traders, tx, volume, dev, bundle, bonding, socials, image, GitHub, mots-clés, Mayhem, LarpCheck), réglages d'affichage, import/export JSON. |
| LarpCheck | ✅ | `/api/larpcheck` : six checks sur l'API GitHub, score /10, tier S–F, heatmap de commits. Scan déclenché à l'ouverture d'un token (pas sur les lignes, pour ménager l'API GitHub), panneau détaillé, page scanner. |
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

- Frais plateforme : **0 %** par défaut (`NEXT_PUBLIC_PLATFORM_FEE_BPS=0`). Si un jour tu veux en prélever, mets des bps et un `NEXT_PUBLIC_FEE_WALLET` : le transfert est ajouté dans la transaction signée par l'utilisateur.
- pump.fun prélève 1 % sur toutes les plateformes.
- Courbe et PumpSwap : aucun intermédiaire (instructions natives, frais pump.fun lus on-chain). PumpPortal (0,5 %) seulement en repli.

## Roadmap

1. Décodage des trades PumpSwap pour un MC live dans la colonne Migrated ; Meteora DLMM pour les coins sans pool PumpSwap.
2. Exécution automatique des TP/SL (worker côté client tant qu'un onglet est ouvert, comme Motion).
3. Tracker de wallets (`subscribe` sur des adresses), alertes.
4. Tout le marché SOL : Bonk (LaunchLab), Believe, Moonshot, puis multi-chaînes (Base, BNB).
5. Carte de verdict LarpCheck partageable (image OG).

## Sécurité

- Non-custodial : clés chiffrées localement, jamais transmises.
- Exporte et sauvegarde la clé privée de chaque wallet : vider le stockage du navigateur la supprime.
- Le trading natif a été validé par simulation mainnet, pas encore par un envoi réel depuis cette app : commence par de petits montants.
