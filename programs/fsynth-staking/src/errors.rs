
use anchor_lang::prelude::*;

#[error_code]
pub enum FsynthError {
    #[msg("Invalid address")]
    InvalidAddress,

    #[msg("not allowed")]
    NotAllowed,
}
