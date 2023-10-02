
pub use hdk_extensions::hdk;
pub use hdk_extensions;
pub use hdk_extensions::hdi_extensions::hdi;
pub use hdk_extensions::hdi_extensions;

use hdk_extensions::hdk::prelude::debug;
use hdi::prelude::*;
use hdi_extensions::{
    ScopedTypeConnector,
    scoped_type_connector,
    // Macros
    valid,
};


//
// Something Entry
//
#[hdk_entry_helper]
#[derive(Clone)]
pub struct SomethingEntry {
    pub name: String,
    pub content: String,
    pub published_at: Option<String>,
}


//
// Entry Types
//
#[hdk_entry_defs]
#[unit_enum(EntryTypesUnit)]
pub enum EntryTypes {
    #[entry_def]
    Something(SomethingEntry),
}

scoped_type_connector!(
    EntryTypesUnit::Something,
    EntryTypes::Something( SomethingEntry )
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
