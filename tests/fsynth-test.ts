import * as anchor from '@project-serum/anchor';
import { FsynthStaking } from '../target/types/fsynth_staking';
import {
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token, AccountInfo } from "@solana/spl-token";
import {use as chaiUse, assert, expect} from 'chai'    
import chaiAsPromised from 'chai-as-promised'
chaiUse(chaiAsPromised)

describe('fsynth-staking', () => {

  // Constants
  const TREASURY_TAG = Buffer.from("treasury");
  const TREASURY_VAULT_TAG = Buffer.from("treasury-vault");
  const POS_MINT_TAG = Buffer.from("pos-mint");
  const USER_POS_VAULT_TAG = Buffer.from("user-pos-vault");

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FsynthStaking as anchor.Program<FsynthStaking>;
  const programId = program.programId
  
  const treasuryAdminKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array([106,82,107,126,10,202,10,103,65,115,164,175,17,116,121,8,239,95,172,94,64,208,184,194,146,46,57,12,251,116,147,77,118,80,38,76,92,111,87,123,169,25,98,122,225,55,190,219,184,163,165,72,152,18,113,67,221,132,250,54,93,106,134,132]));
  const treasuryAdmin = treasuryAdminKeypair.publicKey;
  const userKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array([207,161,134,18,75,110,174,68,15,193,227,0,178,49,8,92,109,227,62,84,218,97,96,16,228,48,166,80,128,160,144,116,77,249,128,240,148,96,60,218,199,158,68,216,10,76,96,92,195,12,83,250,151,180,144,9,116,101,233,124,230,194,179,20]));
  const user = userKeypair.publicKey;
  let treasuryTokenMint: Token = null;
  const mintAmount = 10_000_000_000_000; // 10000 POS

  let userTreasuryVault = null;

  it('Is Initialize!', async () => {
    console.log("treasuryAdmin", treasuryAdmin.toBase58())
    console.log("user", user.toBase58())

    // remove this comment on localnet, but I commented and already airdroped sol to test wallets on devnet
    await safeAirdrop(program.provider.connection, treasuryAdmin, 1000000000)
    await safeAirdrop(program.provider.connection, user, 1000000000)

    treasuryTokenMint = await Token.createMint(
      program.provider.connection,
      treasuryAdminKeypair,
      treasuryAdmin,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    userTreasuryVault = await treasuryTokenMint.createAccount(user);
    await treasuryTokenMint.mintTo(
      userTreasuryVault,
      treasuryAdmin,
      [],
      mintAmount
    );
  })
  let posToken: Token = null;
  it('CreateTreasury !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.publicKey.toBuffer(), treasuryAdmin.toBuffer()], programId)
    const treasuryVault = await pda([TREASURY_VAULT_TAG, treasury.toBuffer()], programId)
    const posMint = await pda([POS_MINT_TAG, treasury.toBuffer()], programId)
    posToken = new Token(program.provider.connection, posMint, TOKEN_PROGRAM_ID, treasuryAdminKeypair)
    
    const tx = await program.rpc.createTreasury(
      {
        accounts: {
          treasury,
          treasuryMint: treasuryTokenMint.publicKey,
          posMint,
          treasuryVault,
          authority: treasuryAdmin,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        },
        signers: [treasuryAdminKeypair]
      });
    console.log("tx = ", tx);
      
    const treasuryData = await program.account.treasury.fetch(treasury);
    assert(treasuryData.authority.equals(treasuryAdmin), "treasuryAdmin")
    assert(treasuryData.treasuryMint.equals(treasuryTokenMint.publicKey), "treasuryMint")
    assert(treasuryData.treasuryVault.equals(treasuryVault), "treasuryVault")
    assert(treasuryData.posMint.equals(posMint), "posMint")
  });

  const stakeAmount = 100_000_000_000; //100 POS
  it('Stake !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.publicKey.toBuffer(), treasuryAdmin.toBuffer()], programId)
    const treasuryVault = await pda([TREASURY_VAULT_TAG, treasury.toBuffer()], programId)
    const posMint = await pda([POS_MINT_TAG, treasury.toBuffer()], programId)
    const userPosVault = await pda([USER_POS_VAULT_TAG, posMint.toBuffer(), user.toBuffer()], programId)
    let treasuryAmountBefore = (await treasuryTokenMint.getAccountInfo(treasuryVault)).amount.toNumber()
    let userPosAmountBefore = 0;
    try{
      userPosAmountBefore = (await posToken.getAccountInfo(userPosVault)).amount.toNumber()
    }catch(e){}

    const tx = await program.rpc.stake(
      new anchor.BN(stakeAmount),
      {
        accounts: {
          treasury,
          posMint,
          treasuryVault,
          userVault: userTreasuryVault,
          userPosVault,
          authority: user,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [userKeypair]
      });
    console.log("tx = ", tx);

    let treasuryAmountAfter = (await treasuryTokenMint.getAccountInfo(treasuryVault)).amount.toNumber()
    let userPosAmountAfter = (await posToken.getAccountInfo(userPosVault)).amount.toNumber()
    assert(treasuryAmountAfter - treasuryAmountBefore === stakeAmount, "stakeAmount")
    assert(userPosAmountAfter - userPosAmountBefore === stakeAmount, "stakeAmount")
  });

  const redeemAmount = 10_000_000_000; //10 POS
  it('Redeem !', async () => {
    const treasury = await pda([TREASURY_TAG, treasuryTokenMint.publicKey.toBuffer(), treasuryAdmin.toBuffer()], programId)
    const treasuryVault = await pda([TREASURY_VAULT_TAG, treasury.toBuffer()], programId)
    const posMint = await pda([POS_MINT_TAG, treasury.toBuffer()], programId)
    const userPosVault = await pda([USER_POS_VAULT_TAG, posMint.toBuffer(), user.toBuffer()], programId)
    let treasuryAmountBefore = (await treasuryTokenMint.getAccountInfo(treasuryVault)).amount.toNumber()
    let userPosAmountBefore = (await posToken.getAccountInfo(userPosVault)).amount.toNumber()
    const tx = await program.rpc.redeem(
      new anchor.BN(redeemAmount),
      {
        accounts: {
          treasury,
          posMint,
          treasuryVault,
          userVault: userTreasuryVault,
          userPosVault,
          authority: user,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [userKeypair]
      });
    console.log("tx = ", tx);

    let treasuryAmountAfter = (await treasuryTokenMint.getAccountInfo(treasuryVault)).amount.toNumber()
    let userPosAmountAfter = (await posToken.getAccountInfo(userPosVault)).amount.toNumber()
    assert(treasuryAmountBefore - treasuryAmountAfter === redeemAmount, "redeemAmount")
    assert(userPosAmountBefore - userPosAmountAfter === redeemAmount, "redeemAmount")
  });
});

async function safeAirdrop(connection: anchor.web3.Connection, destination: anchor.web3.PublicKey, amount = 100000000) {
  while (await connection.getBalance(destination) < amount){
    try{
      // Request Airdrop for user
      await connection.confirmTransaction(
        await connection.requestAirdrop(destination, 100000000),
        "confirmed"
      );
    }catch{}
    
  };
}

async function pda(seeds: (Buffer | Uint8Array)[], programId: anchor.web3.PublicKey) {
  const [pdaKey] = 
      await anchor.web3.PublicKey.findProgramAddress(
        seeds,
        programId,
      );
  return pdaKey
}

async function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}
