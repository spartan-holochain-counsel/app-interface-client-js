import { Logger }			from '@whi/weblogger';
const log				= new Logger("app-interface-client", (import.meta.url === import.meta.main) && process.env.LOG_LEVEL );

import * as ed				from '@noble/ed25519';
import { encode, decode }		from '@msgpack/msgpack';
import {
    DnaHash,
    AgentPubKey,
}					from '@spartan-hc/holo-hash';
import {
    Connection,
}					from '@spartan-hc/holochain-websocket';

import HoloHashes			from '@spartan-hc/holo-hash';
import HolochainWebsocket		from '@spartan-hc/holochain-websocket';
import { hashZomeCall }			from '@spartan-hc/holochain-serialization';
import {
    Transformer,
    Interface,
    CellZomelets,
    Zomelet,
}					from '@spartan-hc/zomelets';
import json				from '@whi/json';

import utils				from './utils.js';
import { Base }				from './base_classes.js';
import { HoloHashMap }			from './holo_hash_map.js';
import {
    ScopedCellZomelets,
    ScopedZomelet,
    CallContext,
}					from './scoped_interfaces.js';

export *				from '@spartan-hc/zomelets';
export *				from './scoped_interfaces.js';

export {
    // Forwarded from @spartan-hc/holo-hash
    HoloHashes,

    // Forwarded from @spartan-hc/holochain-websocket
    HolochainWebsocket,
};



export class AppInterfaceClient extends Base {
    static defaults			= {
	"timeout":		60_000, // 60s
    };
    #conn				= null;
    #agents				= new HoloHashMap();

    constructor ( connection, options ) {
	if ( arguments[0]?.constructor?.name === "AppInterfaceClient" )
	    return arguments[0];

	super( options );

	this.#conn			= new Connection( connection );
    }

    async close ( timeout ) {
	await this.conn.open();

	return await this.conn.close( timeout );
    }

    get agents () {
	return Object.fromEntries( this.#agents );
	// return Object.assign( {}, this.#agents );
    }

    get conn () {
	return this.#conn;
    }

    agent ( pubkey ) {
	if ( this.#agents.get( pubkey ) )
	    throw new Error(`Agent ${pubkey} is already set`);

	const agent_ctx			= new AgentContext( this, pubkey, this.set_options );

	this.#agents.set( agent_ctx.cell_agent, agent_ctx );

	return agent_ctx;
    }

    async app ( app_id ) {
	const app_info			= await this.appInfo( app_id );

	this.log.trace("App info for ID '%s':", app_id, app_info );
	const roles			= {};
	for ( let [name,cell] of Object.entries( app_info.roles ) ) {
	    roles[ name ]		= cell.cell_id[0];
	}

	const agent_ctx			= this.agent( app_info.agent_pub_key );
	const app_client		= agent_ctx.app( app_info.installed_app_id, roles );

	return app_client;
    }

    async request ( method, args, options ) {
	await this.conn.open();

	this.log.trace("Raw request '%s' (timeout: %s):", () => [
	    method, options?.timeout || null, json.debug(args)
	]);
	return await this.conn.request( method, args, options?.timeout || this.options?.timeout );
    }

    async appInfo ( app_id ) {
	const app_info			= await this.request( "app_info", {
	    "installed_app_id": app_id,
	});

	this.log.trace("Raw app info for ID '%s':", app_id, app_info );
	return utils.reformat_app_info( app_info );
    }

    async call ( call_spec, options ) {
	return decode( await this.request( "call_zome", call_spec, options ) );
    }
}
utils.set_tostringtag( AppInterfaceClient, "AppInterfaceClient" );


export class AgentContext extends Base {
    #setup				= null;
    #client				= null;
    #cell_agent				= null;
    #client_secret			= null;
    #client_pubkey			= null;
    #apps				= {};

    constructor ( client, cell_agent, options ) {
	if ( arguments[0]?.constructor?.name === "AgentContext" )
	    return arguments[0];

	super( options );

	this.#client			= client;
	this.#cell_agent		= new AgentPubKey( cell_agent );

	this.#setup			= this.setCapabilityAgent();
    }

    get setup () {
	return this.#setup;
    }

    get client () {
	return this.#client;
    }

    get cell_agent () {
	return new AgentPubKey( this.#cell_agent );
    }

    get client_agent () {
	return new AgentPubKey( this.#client_pubkey );
    }

    get apps () {
	return Object.assign( {}, this.#apps );
    }

    async setCapabilityAgent () {
	this.#client_secret		= ed.utils.randomPrivateKey();
	this.#client_pubkey		= await ed.getPublicKeyAsync( this.#client_secret );

	this.signing_handler		= async ( zome_call_hash ) => {
	    return await ed.signAsync( zome_call_hash, this.#client_secret );
	};
    }

    app ( app_id, roles ) {
	if ( this.#apps[ app_id ] !== undefined )
	    throw new Error(`App ${app_id} is already set`);

	const app_client		= new AppClient( this, roles, this.set_options );

	this.#apps[ app_id ]		= app_client;

	return app_client;
    }

    async call ( dna, zome, func, args = null, options ) {
	await this.setup;

	this.log.trace("AgentContext.call( %s, %s, %s, ... ) [timeout: %s]", dna, zome, func, options?.timeout );
	const client_agent		= this.client_agent;
	const cell_agent		= this.cell_agent;

	this.log.trace("Raw payload", () => [
	    json.debug(args)
	]);
	const zome_call_spec		= {
	    "provenance":	client_agent,
	    "cell_id":		[ dna, cell_agent ],
	    "zome_name":	zome,
	    "fn_name":		func,
	    "payload":		encode( args ),
	    "nonce":		utils.nonce(),
	    "expires_at":	(Date.now() + (5 * 60 * 1000)) * 1000,
	    "cap_secret":	null,
	};

	const zome_call_hash		= hashZomeCall( zome_call_spec );
	const signature			= await this.signing_handler( zome_call_hash, zome_call_spec );

	if ( zome_call_spec.signature === undefined )
	    zome_call_spec.signature	= signature;

	if ( !zome_call_spec.signature )
	    console.log("WARNING: Signed zome call is missing the signature property");

	return await this.client.call( zome_call_spec, options );
    }

}
utils.set_tostringtag( AgentContext, "AgentContext" );


export class AppClient extends Base {
    #agent				= null;
    #roles				= {};
    #cells				= {};

    constructor ( agent_ctx, roles, options ) {
	if ( arguments[0]?.constructor?.name === "AppClient" )
	    return arguments[0];

	super( options );

	this.#agent			= agent_ctx;

	for ( let [name, dna_hash] of Object.entries( roles ) ) {
	    this.#roles[ name ]	= new DnaHash( dna_hash );
	    this.setCellZomelets( name );
	}
	this.log.info("AppClient (for agent '%s') roles:", () => [
	    this.agent.cell_agent, json.debug(this.roles)
	]);
    }

    get agent () {
	return this.#agent;
    }

    get roles () {
	return Object.assign( {}, this.#roles );
    }

    get cells () {
	return Object.assign( {}, this.#cells );
    }

    createScopedCell ( role, cell_spec ) {
	// Verify that there is a matching role name
	if ( !(role in this.roles) )
	    throw new Error(`Role '${role}' is not in client: ${Object.keys(this.roles)}`);

	return new ScopedCellZomelets( this, role, cell_spec, this.set_options );
    }

    setInterface ( config ) {
	for ( let [role, cell_spec] of Object.entries( config ) ) {
	    this.setCellZomelets( role, cell_spec );
	}
    }

    setCellZomelets ( role, cell_spec ) {
	this.#cells[ role ]		= this.createScopedCell( role, cell_spec );
    }

    async call ( role, ...args ) {
	const dna_hash			= this.roles[ role ];
	return await this.agent.call( dna_hash, ...args );
    }

}
utils.set_tostringtag( AppClient, "AppClient" );


export default {
    AppInterfaceClient,
    AgentContext,
    AppClient,

    Transformer,
    Interface,
    CellZomelets,
    Zomelet,

    ScopedCellZomelets,
    ScopedZomelet,
    CallContext,

    // Forwarded from @spartan-hc/holo-hash
    HoloHashes,

    // Forwarded from @spartan-hc/holochain-websocket
    HolochainWebsocket,
};
