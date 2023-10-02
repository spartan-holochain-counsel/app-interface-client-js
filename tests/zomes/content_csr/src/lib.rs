
use content::hdi_extensions;
use content::hdk_extensions;
use hdk_extensions::hdk;

use hdk::prelude::*;
use hdi_extensions::{
    ScopedTypeConnector,
};
use hdk_extensions::{
    must_get,
    // Entity, MorphAddr,
    // // Inputs
    // UpdateEntryInput,
};
use content::{
    SomethingEntry,
    EntryTypes,
};



#[hdk_extern]
fn init(_: ()) -> ExternResult<InitCallbackResult> {
    debug!("'{}' init", zome_info()?.name );
    Ok(InitCallbackResult::Pass)
}


#[hdk_extern]
fn whoami(_: ()) -> ExternResult<AgentInfo> {
    Ok( agent_info()? )
}


#[hdk_extern]
pub fn get_content(addr: ActionHash) -> ExternResult<SomethingEntry> {
    debug!("Get latest content entry: {:#?}", addr );
    let record = must_get( &addr )?;

    Ok( SomethingEntry::try_from_record( &record )? )
}


#[hdk_extern]
pub fn create_content(content: SomethingEntry) -> ExternResult<ActionHash> {
    debug!("Creating new content entry: {:#?}", content );
    debug!("Something entry input: {:#?}", content.to_input() );
    let action_hash = create_entry( EntryTypes::Something(content) )?;

    Ok( action_hash )
}


// #[derive(Clone, Deserialize, Debug)]
// pub struct UpdateInput {
//     base: ActionHash,
//     entry: ContentEntry,
// }

// #[hdk_extern]
// pub fn update_content(input: UpdateInput) -> ExternResult<ActionHash> {
//     debug!("Update content action: {}", input.base );
//     // let prev_content : ContentEntry = must_get( &input.base )?.try_into();
//     let action_hash = update_entry( input.base, input.entry.to_input() )?;

//     register_content_update_to_group!({
//         entry: input.entry,
//         target: action_hash.clone(),
//     })?;

//     Ok( action_hash )
// }
