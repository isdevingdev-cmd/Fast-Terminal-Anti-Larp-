# pump.fun bonding-curve ABI used by the native provider (verified 2026-10-25)

Program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`. Instructions observed on mainnet:

| name | discriminator (hex) | args |
| --- | --- | --- |
| `buy_exact_quote_in_v3` | `e1f7501ed5b38488` | `spend_lamports: u64`, `min_tokens_out: u64`, `track_volume: bool` |
| `sell_v3` | `1c92de7726c469d5` | `token_amount: u64`, `min_sol_out: u64` |

Accounts (same order for buy and sell):

| # | account | derivation | w |
| --- | --- | --- | --- |
| 1 | global | PDA `["global"]` → `4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf` | |
| 2 | mint | | |
| 3 | wSOL mint | `So11111111111111111111111111111111111111112` | |
| 4 | mint token program | owner of the mint (Token-2022 for `create_v2` coins) | |
| 5 | SPL Token program | | |
| 6 | bonding curve | PDA `["bonding-curve", mint]` | w |
| 7 | curve token ATA | ATA(curve, mint, mintTokenProgram) | w |
| 8 | curve wSOL ATA | ATA(curve, wSOL, SPL) | w |
| 9 | user | signer | w |
| 10 | user token ATA | ATA(user, mint, mintTokenProgram) | w |
| 11 | user wSOL ATA | ATA(user, wSOL, SPL) | w |
| 12 | user volume accumulator | PDA `["user_volume_accumulator", user]` | w |
| 13 | fee config | PDA `["fee_config", pumpProgram]` under `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` → `8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt` | |
| 14 | buyback fee recipient | any of the 8 accounts of size 208 owned by the fee program | w |
| 15 | system program | | |
| 16 | event authority | PDA `["__event_authority"]` → `Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1` | |
| 17 | pump program | | |

Global account (prefix): `initialized u8, authority, fee_recipient, initial_virtual_token_reserves u64 (1.073e15), initial_virtual_sol_reserves u64 (30e9), initial_real_token_reserves u64 (793.1e12), token_total_supply u64 (1e15), fee_basis_points u64 (95), withdraw_authority, enable_migrate u8, pool_migration_fee u64, creator_fee_basis_points u64 (5), fee_recipients [pubkey; 7] …`

Events (`Program data:` logs, anchor discriminators):

- `CreateEvent` `1b72a94ddeeb6376`: `name, symbol, uri, mint, bonding_curve, user, creator, timestamp i64, virtual_token_reserves, virtual_sol_reserves, real_token_reserves, token_total_supply, …84 trailing bytes`
- `TradeEvent` `bddb7fd34ee661ee`: `mint, sol_amount, token_amount, is_buy, user, timestamp, virtual_sol_reserves, virtual_token_reserves, real_sol_reserves, real_token_reserves, fee_recipient, fee_basis_points, fee, creator, creator_fee_basis_points, creator_fee, …`
- `CompleteEvent` `5f72619cd42e9808`

Observed quirks:

- Coins are minted with **Token-2022** (`create_v2`), metadata in the `TokenMetadata` extension; older coins are SPL + Metaplex.
- **Mayhem mode** coins have a 2B mint supply (1B curve + 1B agent inventory) — market cap uses the curve's `token_total_supply` (1B).
- Initial `virtual_sol_reserves` varies per coin (30 SOL standard, seen 0.44 and 334 SOL). `initial_virtual_token - initial_real_token` stays 279.9M, so `progress = (1.073e15 - vTok) / 793.1e12` holds.
- Some `TradeEvent`s carry `sol_amount = 0` and `virtual_sol_reserves = 0` (agent/internal moves): ignored for pricing.
- Transactions of **version 1** exist; use `maxSupportedTransactionVersion: 255` when fetching.
