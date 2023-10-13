use content::hdk_extensions;
use content::hdi_extensions;
use content::hdk;

use hdk::prelude::*;
use hdk_extensions::{
    must_get,
    // Inputs
    GetEntityInput,
    // UpdateEntryInput,
};
use hdi_extensions::{
    ScopedTypeConnector,
};
use content::{
    ContentEntry,
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
pub fn create_content(content: ContentEntry) -> ExternResult<ActionHash> {
    debug!("Creating new content entry: {:#?}", content );
    let action_hash = create_entry( content.to_input() )?;

    Ok( action_hash )
}


#[hdk_extern]
pub fn get_content(input: GetEntityInput) -> ExternResult<ContentEntry> {
    debug!("Get latest content entry: {:#?}", input );
    let record = must_get( &input.id )?;

    Ok( ContentEntry::try_from_record( &record )? )
}


#[hdk_extern]
pub fn get_content_by_hash(input: EntryHash) -> ExternResult<ContentEntry> {
    debug!("Get latest content entry: {:#?}", input );
    let record = must_get( &input )?;

    Ok( ContentEntry::try_from_record( &record )? )
}


#[hdk_extern]
pub fn hash_content(content: ContentEntry) -> ExternResult<EntryHash> {
    debug!("Creating new content entry: {:#?}", content );
    let entry_hash = hash_entry( content )?;

    Ok( entry_hash )
}


// #[hdk_extern]
// pub fn update_content(input: UpdateEntryInput<ContentEntry>) -> ExternResult<ActionHash> {
//     debug!("Update content action: {}", input.base );
//     // let prev_content : ContentEntry = must_get( &input.base )?.try_into();
//     let action_hash = update_entry( input.base, input.entry.to_input() )?;

//     Ok( action_hash )
// }
