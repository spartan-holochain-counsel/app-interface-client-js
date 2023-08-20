
import { encode, decode }		from '@msgpack/msgpack';
import {
    DnaHash,
    AgentPubKey,
}					from '@spartan-hc/holo-hash';
import {
    Connection,
}					from '@spartan-hc/holochain-websocket';

import { Base }				from './base_classes.js';

import HoloHashes			from '@spartan-hc/holo-hash';
import HolochainWebsocket		from '@spartan-hc/holochain-websocket';

import {
    set_tostringtag,
    reformat_app_info,
}					from './utils.js';

export {
    // Forwarded from @spartan-hc/holo-hash
    HoloHashes,

    // Forwarded from @spartan-hc/holochain-websocket
    HolochainWebsocket,
};



const holo_hash_proxy_config		= {
};

function HoloHashProxy ( target = {} ) {
    return new Proxy( target, holo_hash_proxy_config );
}

function nonce () {
    return crypto.getRandomValues( new Uint8Array(32) );
}


export class AppInterfaceClient extends Base {
    #_options				= {
	"timeout":		60_000, // 60s
    };
    #_conn				= null;
    #_agents				= HoloHashProxy();

    constructor ( connection, options ) {
	if ( arguments[0] instanceof AppInterfaceClient )
	    return arguments[0];

	super();

	Object.assign( this.#_options, options );

	this.#_conn			= new Connection( connection );
    }

    async close ( timeout ) {
	await this.conn.open();

	return await this.conn.close( timeout );
    }

    get agents () {
	return Object.assign( {}, this.#_agents );
    }

    get conn () {
	return this.#_conn;
    }

    agent ( pubkey ) {
	if ( this.#_agents[ pubkey ] )
	    throw new Error(`Agent ${pubkey} is already set`);

	const agent_ctx			= new AgentContext( this, pubkey );

	this.#_agents[ pubkey ]		= agent_ctx;

	return agent_ctx;
    }

    async app ( app_id ) {
	const app_info			= await this.appInfo( app_id );

	// console.log( app_info );
	const roles			= {};
	for ( let [name,cell] of Object.entries( app_info.roles ) ) {
	    roles[ name ]		= cell.cell_id[0];
	}

	const agent_ctx			= this.agent( app_info.agent_pub_key );
	const app_client		= agent_ctx.app( app_info.installed_app_id, roles );

	return app_client;
    }

    async request ( method, args, timeout ) {
	await this.conn.open();

	return await this.conn.request( method, args, timeout || this.options?.timeout );
    }

    async appInfo ( app_id ) {
	const app_info			= await this.request( "app_info", {
	    "installed_app_id": app_id,
	});

	// console.log( app_info );
	// {
	//     installed_app_id: 'test-alice',
	//     cell_info: { storage: [ [Object] ] },
	//     status: { running: null },
	//     agent_pub_key: Uint8Array(39) [
	//         132,  32,  36, 231,  86,  88, 237, 207,  77,
	//         37, 136,  27,  14,  52,  20, 134, 197,  46,
	//         239, 162, 166, 213, 176, 112,  67,  44, 178,
	//         6, 164,  13, 102, 193,  24, 108, 122, 152,
	//         95, 205,  67
	//     ],
	//     manifest: {
	//         manifest_version: '1',
	//         name: 'Storage',
	//         description: 'Simple byte storage',
	//         roles: [ [Object] ]
	//     }
	// }
	// for ( let [role_name, cell] of Object.entries( app_info.cell_info ) ) {
	//     console.log( cell );
	//     cell.cell_id[0]; // DNA
	//     cell.cell_id[1]; // Agent
	// }

	return reformat_app_info( app_info );
    }

    async call ( call_spec, timeout ) {
	return await this.request( "call_zome", call_spec, timeout );
    }

    // async call ( connection, client_agent, cell_agent, dna, func, payload, signing_handler, secret, timeout ) {
    // 	if ( this._methods.includes( func ) ) {
    // 	    // TODO: implement transformers
    // 	}
    // 	else if ( this._methods !== null && this._methods.length !== 0 ) {
    // 	    throw new Error(`Unknown Zome function: ${func}; expected one of ${ this._methods }`);
    // 	}

    // 	const zomeCall			= {
    // 	    "provenance":	client_agent,
    // 	    "cell_id":		[ dna, cell_agent ],
    // 	    "zome_name":	this._name,
    // 	    "fn_name":		func,
    // 	    "payload":		encode( payload ),
    // 	    "nonce":		nonce(),
    // 	    "expires_at":	(Date.now() + (5 * 60 * 1000)) * 1000,
    // 	    "cap_secret":	secret,
    // 	};
    // 	const signedZomeCall		= await signing_handler( zomeCall );

    // 	if ( !signedZomeCall.signature )
    // 	    log.debug && log("WARNING: Signed zome call is missing the signature property");

    // 	const resp			= await connection.request("call_zome", signedZomeCall, timeout || this._timeout );

    // 	return decode( resp );
    // }

    // async call ( dna_role_name, zome, func, payload, timeout ) {
    // 	const conn			= await this.connection();

    // 	if ( conn._opened === false ) {
    // 	    log.debug && log("Opening connection '%s' for AgentClient", conn.name );
    // 	    await conn.open();
    // 	}

    // 	const req_ctx			= {
    // 	    "start": new Date(),
    // 	    "end": null,
    // 	    "dna": dna_role_name,
    // 	    "zome": zome,
    // 	    "func": func,
    // 	    "input": payload,
    // 	    "timeout": timeout,
    // 	    duration () {
    // 		return ( req_ctx.end || new Date() ) - req_ctx.start;
    // 	    },
    // 	};

    // 	let dna_schema			= this._app_schema.dna( dna_role_name );
    // 	let zome_api			= dna_schema.zome( zome );

    // 	payload				= await this._run_processors( "input", payload, req_ctx );

    // 	let result			= await zome_api.call(
    // 	    conn,
    // 	    this.capabilityAgent(),
    // 	    this.cellAgent(),
    // 	    dna_schema.hash(),
    // 	    func,
    // 	    payload,
    // 	    this.signing_handler,
    // 	    this._cap_secret,
    // 	    timeout || this._options.timeout,
    // 	);

    // 	result				= await this._run_processors( "output", result, req_ctx );

    // 	req_ctx.end			= new Date();

    // 	return result;
    // }
}


export class AgentContext extends Base {
    #_client				= null;
    #_pubkey				= null;
    #_apps				= {};

    constructor ( client, pubkey ) {
	if ( arguments[0] instanceof AgentContext )
	    return arguments[0];

	super();

	this.#_client			= client;
	this.#_pubkey			= new AgentPubKey( pubkey );
    }

    get client () {
	return this.#_client;
    }

    get pubkey () {
	return new AgentPubKey( this.#_pubkey );
    }

    get apps () {
	return Object.assign( {}, this.#_apps );
    }

    app ( app_id, roles ) {
	if ( this.#_apps[ app_id ] !== undefined )
	    throw new Error(`App ${app_id} is already set`);

	const app_client		= new AppClient( this, roles );

	this.#_apps[ app_id ]		= app_client;

	return app_client;
    }

    async call ( dna, zome, func, args, timeout ) {
	const client_agent		= this.pubkey;
	const cell_agent		= this.pubkey;

	const zomeCall			= {
	    "provenance":	client_agent,
	    "cell_id":		[ dna, cell_agent ],
	    "zome_name":	zome,
	    "fn_name":		func,
	    "payload":		encode( args ),
	    "nonce":		nonce(),
	    "expires_at":	(Date.now() + (5 * 60 * 1000)) * 1000,
	    "cap_secret":	null,
	    "signature":	crypto.getRandomValues( new Uint8Array(64) ),
	};

	// const signedZomeCall		= await signing_handler( zomeCall );

	// if ( !signedZomeCall.signature )
	//     console.log("WARNING: Signed zome call is missing the signature property");

	return await this.client.call( zomeCall, timeout );
    }

}


export class AppClient extends Base {
    #_agent				= null;
    #_roles				= {};
    #_cells				= {};

    constructor ( agent_ctx, roles ) {
	if ( arguments[0] instanceof AppClient )
	    return arguments[0];

	super();

	this.#_agent			= agent_ctx;

	for ( let [name, dna_hash] of Object.entries( roles ) ) {
	    this.#_roles[ name ]	= new DnaHash( dna_hash );
	    this.setCellInterface( name );
	}
    }

    get agent () {
	return this.#_agent;
    }

    get roles () {
	return Object.assign( {}, this.#_roles );
    }

    get cells () {
	return Object.assign( {}, this.#_cells );
    }

    setInterface ( config ) {
	for ( let [role, cell_spec] of Object.entries( config ) ) {
	    this.setCellInterface( role, cell_spec );
	}
    }

    setCellInterface ( role, cell_spec ) {
	this.#_cells[ role ]		= new ScopedCellInterface( this, role, cell_spec );
    }

    async call ( role, ...args ) {
	const dna_hash			= this.roles[ role ];
	return await this.agent.call( dna_hash, ...args );
    }

}


class ScopedCellInterface extends Base {
    #_client				= null;
    #_role				= null;
    #_spec				= null;
    #_zomes				= {};

    constructor ( client, role, cell_spec ) {
	if ( arguments[0] instanceof ScopedCellInterface )
	    return arguments[0];

	super();

	this.#_client			= client;
	this.#_role			= role;
	this.#_spec			= new CellInterface( cell_spec );

	Object.entries( this.spec.zomes ).forEach( ([name, zome_spec]) => {
	    this.#_zomes[ name ]	= new ScopedZomeInterface( this, name, zome_spec );
	});
    }

    get client () {
	return this.#_client;
    }

    get role () {
	return this.#_role;
    }

    get spec () {
	return this.#_spec;
    }

    get zomes () {
	return Object.assign( {}, this.#_zomes );
    }

    async call ( ...args ) {
	return await this.client.call( this.role, ...args );
    }
}


class ScopedZomeInterface extends Base {
    #_cell				= null;
    #_name				= null;
    #_spec				= null;
    #_functions				= {};

    constructor ( scoped_cell, name, zome_spec ) {
	if ( arguments[0] instanceof ScopedZomeInterface )
	    return arguments[0];

	super();

	this.#_cell			= scoped_cell;
	this.#_name			= name;
	this.#_spec			= new ZomeInterface( zome_spec );

	const self			= this;
	Object.entries( this.spec.handlers ).forEach( ([name, handler]) => {
	    this.#_functions[ name ]	= async function ( ...args ) {
		const ctx		= new CallContext( self );
		return await handler.apply( ctx, args );
	    };
	});
    }

    get cell () {
	return this.#_cell;
    }

    get name () {
	return this.#_name;
    }

    get spec () {
	return this.#_spec;
    }

    get functions () {
	return Object.assign( {}, this.#_functions );
    }

    async call ( ...args ) {
	return await this.cell.call( this.name, ...args );
    }
}


export class CellInterface extends Base {
    #_zomes				= {};

    constructor ( config = {} ) {
	if ( arguments[0] instanceof CellInterface )
	    return arguments[0];

	super();

	for ( let [name, handler] of Object.entries( config ) ) {
	    this.setZomeInterface( name, handler );
	}
    }

    get zomes () {
	return Object.assign( {}, this.#_zomes );
    }

    setZomeInterface ( name, zome_spec ) {
	this.#_zomes[ name ]		= new ZomeInterface( zome_spec );
    }
}


export class ZomeInterface extends Base {
    #_handlers				= {};

    constructor ( config ) {
	if ( arguments[0] instanceof ZomeInterface )
	    return arguments[0];

	super();

	for ( let [name, handler] of Object.entries( config ) ) {
	    this.setFunction( name, handler );
	}
    }

    get handlers () {
	return Object.assign( {}, this.#_handlers );
    }

    setFunction ( name, handler ) {
	this.#_handlers[ name ]		= normalizeFunctionHandler( name, handler );
    }
}


function normalizeFunctionHandler ( name, handler ) {
    if ( typeof handler !== "function" ) {
	if ( !(handler.input || handler.output) )
	    throw new Error(`Zome function handler must be a function or have input/output methods`);

	if ( handler.input && typeof handler.input !== "function" )
	    throw new Error(`Zome function handler input must be a function`);

	if ( handler.output && typeof handler.output !== "function" )
	    throw new Error(`Zome function handler output must be a function`);

	handler			= function ( input ) {
	    if ( handler.input )
		input		= handler.input( input ) || input;

	    let output		= this.call( input );

	    if ( handler.output )
		output		= handler.output( output ) || output;

	    return output;
	};
    }

    return handler;
}


export class CallContext extends Base {
    #_zome				= null;

    constructor ( scoped_zome ) {
	super();

	this.#_zome			= scoped_zome;
    }

    get zome () {
	return this.#_zome;
    }

    async call ( ...args ) {
	return await this.zome.call( ...args );
    }
}


export default {
    AppInterfaceClient,
    AgentContext,
    AppClient,

    CellInterface,
    ZomeInterface,

    // Forwarded from @spartan-hc/holo-hash
    HoloHashes,

    // Forwarded from @spartan-hc/holochain-websocket
    HolochainWebsocket,
};
