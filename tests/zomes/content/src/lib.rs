pub use hdk_extensions::hdi;
pub use hdk_extensions::hdk;
pub use hdk_extensions::hdi_extensions;
pub use hdk_extensions;

use hdi::prelude::*;
use hdk::prelude::debug;
use hdi_extensions::{
    ScopedTypeConnector,
    scoped_type_connector,
};
pub use hdi_extensions::{
    // Macros
    valid, invalid,
};



//
// Content Entry
//
#[hdk_entry_helper]
#[derive(Clone)]
pub struct ContentEntry {
    pub name: String,
    pub content: String,
}


//
// Entry Types
//
#[hdk_entry_defs]
#[unit_enum(EntryTypesUnit)]
pub enum EntryTypes {
    #[entry_def]
    Content(ContentEntry),
}

scoped_type_connector!(
    EntryTypesUnit::Content,
    EntryTypes::Content( ContentEntry )
);


//
// Link Types
//
#[hdk_link_types]
pub enum LinkTypes {
    Generic,
}


//
// Validation
//
#[hdk_extern]
fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    debug!("Validating op: {:#?}", op );
    match op.flattened::<EntryTypes, LinkTypes>()? {
        _ => valid!(),
    }
}
