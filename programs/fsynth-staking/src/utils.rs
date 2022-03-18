use anchor_lang::prelude::*;
use crate::errors::*;

pub fn assert_pda(seeds:&[&[u8]], program_id: &Pubkey, goal_key: &Pubkey) -> Result<()> {
    let (found_key, _bump) = Pubkey::find_program_address(seeds, program_id);
    if found_key != *goal_key {
        return Err(error!(FsynthError::InvalidAddress));
    }
    Ok(())
}

pub fn bump(seeds:&[&[u8]], program_id: &Pubkey) -> u8 {
    let (_found_key, bump) = Pubkey::find_program_address(seeds, program_id);
    bump
}

pub fn is_zero_account(account_info:&AccountInfo)->bool{
    let account_data: &[u8] = &account_info.data.borrow();
    let len = account_data.len();
    let mut is_zero = true;
    for i in 0..len-1 {
        if account_data[i] != 0 {
            is_zero = false;
        }
    }
    is_zero
}

pub fn has_control(flag: bool) -> Result<()> {
    require!(flag, FsynthError::NotAllowed);

    Ok(())
}

pub fn require(flag: bool, err_msg: &str) -> Result<()> {
    if !flag {
        msg!(err_msg);
        return Err(error!(FsynthError::NotAllowed));
    }
    Ok(())
}
