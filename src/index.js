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
import {
    ORMProxy,
    CellsProxy,
}					from './proxies.js';
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

	this.conn.on(`signal`, payload => {
	    this.log.debug("%s - recv signal (agent: %s)", this.name, payload.agent );
	    const event_name		= `signal/${payload.agent}`
	    this.emit( event_name, payload );
	    this.log.debug("%s - emit signal 'signal/%s' to %s listeners", () => [
		this.name, payload.agent, this.listenerCount( event_name ) ]);
	});
    }

    async close ( timeout ) {
	await this.conn.open();

	return await this.conn.close( timeout );
    }

    get name () {
	return `[#${this.id}] ${this.conn._uri} (${Object.keys(this.agents).length} agents)`;
    }

    get agents () {
	return Object.fromEntries( this.#agents );
    }

    get conn () {
	return this.#conn;
    }

    agent ( pubkey ) {
	pubkey				= new AgentPubKey( pubkey );

	if ( this.#agents.has( pubkey ) )
	    return this.#agents.get( pubkey );

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

	if ( app_info === null )
	    throw new Error(`App ID '${app_id}' is not running`);

	this.log.trace("Raw app info for ID '%s':", app_id, app_info );
	return utils.reformat_app_info( app_info );
    }

    async call ( call_spec, options ) {
	return decode( await this.request( "call_zome", call_spec, options ) );
    }
}
utils.set_tostringtag( AppInterfaceClient );


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

	this.log.info("Listening for 'signal/%s' events", this.cell_agent );
	this.client.on(`signal/${this.cell_agent}`, payload => {
	    this.log.debug("%s - recv signal (DNA: %s)", this.name, payload.dna );
	    const event_name		= `signal/${payload.dna}`;
	    this.emit( event_name, payload );
	    this.log.debug("%s - emit signal 'signal/%s' to %s listeners", () => [
		this.name, payload.dna, this.listenerCount( event_name ) ]);
	});
    }

    get name () {
	return `${this.cell_agent} via ${this.client.name}`;
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
utils.set_tostringtag( AgentContext );


export class AppClient extends Base {
    #agent				= null;
    #roles				= {};
    #virtual_roles			= {};
    #orm				= null;

    constructor ( agent_ctx, roles, options ) {
	if ( arguments[0]?.constructor?.name === "AppClient" )
	    return arguments[0];

	super( options );

	this.#agent			= agent_ctx;
	this.#orm			= new ORMProxy( {}, ( role ) => {
	    const tmp_scoped_cell	= this.createCellInterface( role );

	    return tmp_scoped_cell.orm;
	});

	for ( let [name, dna_hash] of Object.entries( roles ) ) {
	    this.#roles[ name ]	= new DnaHash( dna_hash );

	    this.agent.on(`signal/${this.roles[name]}`, payload => {
		this.log.debug("%s - recv signal (role: %s)", this.name, name );
		const role_payload	= {
		    "role": name,
		    ...payload,
		};

		for ( let event_name of [ `signal/${name}`, "signal/*" ] ) {
		    this.emit( event_name, role_payload );
		    this.log.debug("%s - emit signal '%s' to %s listeners", () => [
			this.name, event_name, this.listenerCount( event_name ) ]);
		}
	    });
	}
	this.log.info("AppClient (for agent '%s') roles:", () => [
	    this.agent.cell_agent, json.debug(this.roles)
	]);
    }

    get name () {
	return `${this.agent.cell_agent} (port: ?)`;
    }

    get agent () {
	return this.#agent;
    }

    get agent_id () {
	return this.agent.cell_agent;
    }

    get roles () {
	return Object.assign( {}, this.#roles );
    }

    get roleNames () {
	return Object.keys( this.#roles );
    }

    get virtual_roles () {
	return Object.assign( {}, this.#virtual_roles );
    }

    get virtualRoleNames () {
	return Object.keys( this.#virtual_roles );
    }

    get orm () {
	return this.#orm;
    }

    getRoleDnaHash ( role ) {
	if ( role in this.roles )
	    return this.roles[ role ];

	if ( role in this.virtual_roles )
	    return null;

	throw new Error(`Role '${role}' is not in client; available roles ${this.roleNames.join(", ")} [vituals: ${this.virtualRoleNames.join(", ")}]`);
    }

    createVirtualCells ( config ) {
	for ( let [role, forwarder] of Object.entries( config ) ) {
	    this.createVirtualCell( role, forwarder );
	}
    }

    createVirtualCell ( name, forwarder ) {
	const self			= this;

	this.#virtual_roles[ name ]	= async function ( ctx, dna, zome, func, args, opts ) {
	    return await forwarder.call( ctx, name, dna, zome, func, args, opts );
	};
    }

    createVirtualCellInterface ( role, cell_spec ) {
	const self			= this;

	return function ( dna ) {
	    return new ScopedCellZomelets( self, role, true, dna, cell_spec, self.set_options );
	};
    }

    createInterface ( config ) {
	const cells			= new CellsProxy( {}, `AppClient '${this.name}'` );

	for ( let [role, cell_spec] of Object.entries( config ) ) {
	    cells[ role ]		= this.createCellInterface( role, cell_spec );
	}

	return cells;
    }

    createCellInterface ( role, cell_spec = {} ) {
	const dna_hash			= this.getRoleDnaHash( role );

	// DNA hash might be 'null' because virtual cells are allowed to be referenced by a
	// ScopedCellZomelets instance but the instance will fail if any function is called.
	return new ScopedCellZomelets( this, role, false, dna_hash, cell_spec, this.set_options );
    }

    createZomeInterface ( role, zome_name, zome_spec ) {
	return this.createCellInterface( role, {
	    [zome_name]: zome_spec,
	}).zomes[ zome_name ];
    }

    async callVirtual ( ctx, role, ...args ) {
	const handler			= this.virtual_roles[ role ];

	if ( !handler )
	    throw new Error(`Virtual role '${role}' has not been defined in client: ${this.name}; available virtual roles are ${this.virtualRoleNames.join(', ')}`);

	return await handler( ctx, ...args );
    }

    async call ( role, ...args ) {
	const dna_hash			= this.roles[ role ];

	if ( !dna_hash )
	    throw new Error(`Role '${role}' is not in client: ${this.name}; available roles are ${this.roleNames.join(', ')}`);

	return await this.agent.call( dna_hash, ...args );
    }

}
utils.set_tostringtag( AppClient );


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
