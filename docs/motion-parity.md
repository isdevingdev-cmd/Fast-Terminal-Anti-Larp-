# Parité fonctionnelle avec Motion (relevé du 2026-10-25, motion.gift/sol)

Relevé écran par écran du terminal Motion, fait avec l'accord de son auteur, pour reconstruire
les mêmes écrans dans notre code. ✅ = fait chez nous, 🟡 = partiel, ⬜ = à faire.

## Navigation
- Barre : logo · Tranchées · Alpha · $TOKEN · Portefeuille · Manifeste · ⋯ · recherche · langue · prix du token natif · « Nouveau design » · sélecteur de chaîne (SOL/HOOD/BNB/NEAR) · cloche · Connexion · compteur de wallets · thème.
- Bandeau FAVORIS (tokens épinglés avec MC live) ⬜ · bandeau Alpha défilant (posts X/GMGN/fomo) ⬜.
- Pied : BTC/ETH/SOL/BNB, gas, « ≈ fee », CONNECTÉ, FPS. ✅ (sans gas EVM)

## Trenches (3 colonnes : NOUVEAU · PRESQUE BONDED (tri % MC) · MIGRÉ)
En-tête colonne : compteur, tri, preset « Rapide » (Eco/Fast/Turbo), montant quick buy, son on/off ⬜, filtres ✅, barre de recherche (option) ⬜.

Ligne (`article.row`, data-address, data-mc) :
- avatar (carré/rond) avec anneau/barre de bonding ✅ (barre), badge launchpad (pump/pumpswap) 🟡, « Bonding: x% » au survol ⬜, CA copiable ✅
- actions au survol : masquer le token ⬜, blacklister le dev ⬜, favori ⬜
- symbole, nom, « Tax 1.25% · creator 0.3% » ⬜ (frais pump lus on-chain : fee config + creator fee), quote (SOL/USDC/BTC…) ⬜, « BC x% » ✅, âge ✅
- @handle X + followers + ✓ ⬜ (métadonnées + indexeur X), lien « X search CA » ⬜, lien dev wallet ✅ (page token)
- métriques : V, MC, F (fees générés), TX, holders, buys, top10 %, dev %, snipers %, bundle %, insiders ⬜, « ×N » doublons de nom ⬜
- bouton « Acheter 0.05 » (taille Small/Large/Mega/Jumbo, second bouton Buy×2/Vendre, déclenchement press/release, badge holding SOL/USD) 🟡

Réglages d'affichage (« Personnaliser », dialogue « trenches display ») :
- Disposition : taille des métriques, tables fusionnées/espacées, barre de recherche, forme image, barre de progression (ring/bar/both/off), placement du volume, MC arrondies, bonding au survol, tokens masqués, « unhide on migrated » 🟡
- Ligne (Row elements) : cases à cocher MC, Volume, TXs, Net Buy, Total Fees, ATH MC, Liquidity, Holders, Top10, DEV, Snipers, Bundlers, Insiders, Token Tax, Quote, B.Curve %, Age, CA, Token name, Socials, X Search, Dev Wallet, X Handle, Launchpad badge ⬜
- Ordre des tables ⬜ · Suivi (tracker) ⬜ · Metric Colors (seuils colorés MC/Volume/Holders/Tweet age) ⬜ · Hover Previews ⬜ · Extra ⬜ · Import/Export ✅

Filtres (par colonne, « Apply to all lanes », profils) :
- Missing value : Exclude/Show ⬜ · Profiles ⬜
- Keywords : include/exclude ✅, X @handle ⬜, dev wallet ⬜
- Launchpads : Pump.fun / PumpSwap (+ autres à venir) ⬜ · Quote tokens : SOL / autres ⬜
- Token audit : exclude vamped (n/a SOL), original avatar ⬜, has socials ✅, buys ≥ sells ⬜
- Market & trading : B.Curve % ✅, Age ✅, Liquidity ⬜, MKT Cap ✅, Volume ✅, TXs ✅ (min), Buys/Sells ⬜
- Fees & taxes : total fees SOL ⬜, total tax % ⬜
- Holders & risk : total holders 🟡 (traders), bot degens ⬜, top10 % ⬜, dev % ✅, insiders % ⬜, bundlers % ✅, fresh % ⬜, snipers % ⬜

## Page token (`/sol/token/<mint>`)
- Bandeau : avatar, symbole, nom, « Tax a% / b% », « x% bonded », âge, ⋯ ; MC ; PRIX ; LIQUIDITÉ ; 24H VOL ; OFFRE ; TOTAL FEES ; TOTAL TAX ; BONDING ; badge « Pump.fun curve » 🟡
- Barre chart : 1s/5s/15s/1m/5m ✅, options d'affichage ⬜, alertes de prix ⬜, masquer les bulles ⬜, bubblemap ⬜, mes transactions ⬜ (marqueurs), USD/SOL ✅, MCap/Prix 🟡
- Chart : légende OHLC + volume ✅, 6h/3h/1h/15m/5m fenêtres ⬜, horloge, %, log, auto ⬜
- Onglets bas : Transactions ✅, Positions ⬜, Ordres actifs ⬜, Meilleurs traders ✅, Bundles ⬜, Détenteurs ⬜, Callouts ⬜, Lancements du dev ⬜, Historique ⬜
- Bandeau sécurité : score x/9, Bundle, Snipers, Dev, Initiés, Top 10, Détenteurs, Lancements du dev 🟡
- Filtres du tape : Tout/Vous/Dev/Snipers/Bundlers/Smart/Baleine/Frais/Bots 🟡 (Dev, Moi)
- Panneau droit : 5M/1H/24H/ATH, VOL/ACHATS/VENTES/ACHAT NET ⬜ ; Quick ; Acheter/Vendre/Auto ; MARCHÉ / LIMIT / DCA ⬜ ; presets 0.01/0.05/0.1/0.5 ✅ ; « 1 SOL ≈ x TOKEN » ✅ ; Vente auto (TP/SL) ⬜ ; Audit de sécurité (bundle, snipers, total tax, creator tax, dev h., initiés, top10 h., frais du pool, route, migration) 🟡

## Wallets
- Dialogue : wallets multiples (jusqu'à 100), recherche, « trades groupés » multi-wallets ⬜, actualiser, sauvegarde chiffrée (fichier .json + mot de passe) ⬜, pont Relay ⬜, distribuer/consolider ⬜, retirer, import clés (.txt/.csv) 🟡, « 0% platform fees · 2FA et export des clés ».
- Coffre : clés dans une iframe d'origine isolée (vault.motion.gift) ⬜ (chez nous : chiffrées dans le localStorage de l'app).

## Moteur (motion-vault, src/solEngine.ts) — repris dans `src/lib/trade/pumpRouter.ts`
- Route : mint + curve + pool PumpSwap canonique en une lecture ✅ ; Meteora DLMM pour les coins sans pool SOL ⬜
- Quotes : paliers de frais lus dans fee_config (pump) et amm fee config (PumpSwap) ✅ ; creator fee ✅
- Envoi : plan Eco/Fast/Turbo avec tip floor Jito (p75/p95) et niveaux de priority fee (Helius) ⬜ (chez nous : presets fixes), simulation avant envoi en Fast ⬜, multi-routes RPC + Jito régions ⬜, hold gate tant que le statut est inconnu ⬜

## Positionnement frais (à décider)
Motion affiche « 0% platform fees » et fait payer uniquement le réseau. Notre 0,5 % reste sous Photon (1 %) et Axiom (0,75 %), mais au-dessus de Motion.
