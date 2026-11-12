# Cults

every coin is a cult.

Cults turns any Solana coin into a cult, read straight from the chain:

- **census**: every holder of any coin, from the token program (pools and curves left out)
- **vow**: a memo transaction the holder signs: `cults:vow:1:<mint>:<amount>:<days>`, plus a 0-lamport touch of the tag address. Nothing is locked or held.
- **rank**: initiate, acolyte (7d), zealot (30d), elder (90d). The twelve with the most faith form the circle; the first is the prophet. Faith = share of supply sworn x days kept.
- **apostasy**: holding less than you swore before the vow ends, read from the token account's own history. Broken vows go on the wall.
- **blessing**: anyone can send SOL to a cult's faithful, split by faith, signed in their own wallet, in batches with a memo.

No database: every rite touches one tag address (`8J6D488rtDnXUoETwwv8pDXRHmHW1iNkpv2JPDqMtm2z`) and the site is rebuilt from the chain on each read.

## Settings (Vercel environment variables, all optional)

- `RPC_URL`: a paid Solana RPC (recommended; the public ones rate-limit)
- `CULTS_CA`: the $CULTS mint, shows CA + buy buttons
- `CULTS_X`: the X profile URL

## Self-checks

- `/api/cults?a=ping`
- `/api/cults?a=sim&kind=vow&w=<a holder>&mint=<coin>`: dry-runs the exact vow transaction on mainnet (never signed)
- `/api/cults?a=sim&kind=bless&w=<a wallet with SOL>`: dry-runs a full blessing batch to brand-new wallets

Independent. Not affiliated with pump.fun. Nothing here is financial advice.
