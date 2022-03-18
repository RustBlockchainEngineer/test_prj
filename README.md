## task
Using Anchor, we'd like you to build a basic xToken staking program. A user should be able to deposit a specific token into a program-controlled vault and receive a proof of staking (PoS) token 1:1, and conversely redeem the PoS token for the locked tokens. Tests must be included.

## Implementation
coding & testing time: a few hours

I wrote all unit tests and passed

how to run local tests:

solana config set --url localhost
solana config set --keypair test-keypair.json
yarn install
anchor test
