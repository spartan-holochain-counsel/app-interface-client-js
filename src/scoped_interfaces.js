import { Logger }			from '@whi/weblogger';
const log				= new Logger("scoped-interfaces", (import.meta.url === import.meta.main) && process.env.LOG_LEVEL );

import utils				from './utils.js';
import { Base }				from './base_classes.js';
import {
    CellsProxy,
    ZomesProxy,
    FunctionsProxy,
    PeerCellsProxy,
    PeerZomesProxy,
    PeerFunctionsProxy,
}					from './proxies.js';
import {
    CellZomelets,
    Zomelet,
}					from '@spartan-hc/zomelets';


export class ScopedCellZomelets extends Base {
    #client				= null;
    #role				= null;
    #spec				= null;
    #zomes				= null;

    constructor ( client, role, cell_spec, options ) {
	if ( arguments[0]?.constructor?.name === "ScopedCellZomelets" )
	    return arguments[0];

	const zomelets			= new CellZomelets( cell_spec );

	// console.log("CellZomelets set options:", zomelets.options, options );
	super( zomelets.options, options );

	this.#client			= client;
	this.#role			= role;
	this.#spec			= zomelets;
	this.#zomes			= new ZomesProxy( {}, this.role );

	Object.entries( this.spec.zomes ).forEach( ([name, zome_spec]) => {
	    this.#zomes[ name ]		= new ScopedZomelet( this, name, zome_spec, this.set_options );
	});
    }

    get client () {
	return this.#client;
    }

    get role () {
	return this.#role;
    }

    get spec () {
	return this.#spec;
    }

    get zomes () {
	return Object.assign( {}, this.#zomes );
    }

    async call ( ...args ) {
	const input			= await this.spec.processInput( args ) || args;
	const output			= await this.client.call( this.role, ...input ) ;

	return await this.spec.processOutput( output );
    }
}
utils.set_tostringtag( ScopedCellZomelets, "ScopedCellZomelets" );


export class ScopedZomelet extends Base {
    #cell				= null;
    #name				= null;
    #spec				= null;
    #cells				= null;
    #zomes				= null;
    #functions				= null;

    constructor ( scoped_cell, name, zome_spec, options ) {
	if ( arguments[0]?.constructor?.name === "ScopedZomelet" )
	    return arguments[0];

	const zomelet			= new Zomelet( zome_spec );

	// console.log("Zomelet set options:", zomelet.options, options );
	super( zomelet.options, options );

	utils.assert( name, "string" );
	this.log.trace("ScopedZomelet", ...arguments );

	this.#cell			= scoped_cell;
	this.#name			= name;
	this.#spec			= zomelet;
	this.#cells			= new CellsProxy( {}, this.name );
	this.#zomes			= new ZomesProxy( {}, this.name );
	this.#functions			= new FunctionsProxy( {}, this.name );

	// Peer cells from the perspective of this zomelet
	this.log.trace("Adding peer cells to Zomelet (%s):", this.name, this.spec.cells );
	for ( let [role_name, cell_spec] of Object.entries( this.spec.cells ) ) {
	    // Create a scoped cell for the role
	    this.log.trace("Adding peer cell '%s' to Zomelet (%s):", role_name, this.name, cell_spec );
	    this.#cells[ role_name ]	= this.cell.client.createScopedCell( role_name, cell_spec );
	}

	// Peer zomes from the perspective of this zomelet
	for ( let [name, peer_spec] of Object.entries( this.spec.zomes ) ) {
	    this.#zomes[ name ]		= new ScopedZomelet( scoped_cell, name, peer_spec, this.set_options );
	}
	this.log.debug("ScopedZomelet '%s' has %s peer zomes: %s", () => [
	    this.name, Object.keys(this.zomes).length, Object.keys(this.zomes)
	]);

	for ( let [name, handler] of Object.entries( this.spec.handlers ) ) {
	    this.#functions[ name ]	= this.#contextWrapper( name, handler );
	}
    }

    #contextWrapper ( name, handler ) {
	const self			= this;

	return async function ( args, ...extra ) {
	    // 'this' will either be the parent context or we create a new one
	    const ctx			= this?.constructor?.name === "CallContext"
		  ? this.childContext( self, name )
		  : new CallContext( self, name );
	    self.log.debug("Begin call %s", ctx.repr );

	    const log_msg		= "%s%ss to finish call #%s with %s subcalls; %s";
	    const log_args_fn		= () => {
		const indent	= ctx.heritage
		      .map( parent => parent.position > 0 ? `│  ` : "   ")
		      .join("");
		return [
		    ctx.depth ? `${indent}${ctx.position ? '├' : '┌'}─ ` : "",
		    ctx.duration_seconds,
		    ctx.position,
		    ctx.subcall_count,
		    ctx.repr,
		];
	    };

	    try {
		const result		= await handler.call( ctx, args, ...extra );
		ctx.log.normal( log_msg, log_args_fn );
		return result;
	    } catch (err) {
		ctx.log.error( log_msg, log_args_fn );
		throw err;
	    } finally {
		self.log.debug("End call %s", ctx.repr );
	    }
	};
    }

    get cell () {
	return this.#cell;
    }

    get name () {
	return this.#name;
    }

    get spec () {
	return this.#spec;
    }

    get cells () {
	return Object.assign( {}, this.#cells );
    }

    get zomes () {
	return Object.assign( {}, this.#zomes );
    }

    get functions () {
	return Object.assign( {}, this.#functions );
    }

    async call ( ...args ) {
	this.log.trace("ScopedZomelet: %s", this.name );
	const input			= await this.spec.processInput( args ) || args;
	const output			= await this.cell.call( this.name, ...input ) ;

	return await this.spec.processOutput( output );
    }
}
utils.set_tostringtag( ScopedZomelet, "ScopedZomelet" );


export class CallContext extends Base {
    #heritage				= [];
    #cell				= null;
    #zome				= null;
    #func				= null;
    #args				= null;
    #start_time				= null;
    #end_time				= null;
    #position				= null;
    #children				= [];
    #cells				= null;
    #zomes				= null;
    #functions				= null;

    constructor ( scoped_zome, fn_name, parent_ctx ) {
	super( scoped_zome.set_options );

	if ( parent_ctx ) {
	    this.log.debug("Parent context:", parent_ctx );
	    this.#heritage.push( ...parent_ctx.heritage, parent_ctx );
	}

	this.name			= `${scoped_zome.cell.role}::${scoped_zome.name}->${fn_name}`;
	this.#cell			= scoped_zome.cell;
	this.#zome			= scoped_zome;
	this.#func			= fn_name;
	this.#start_time		= new Date();
	this.#cells			= new PeerCellsProxy( {}, this.#cell.name );
	this.#zomes			= new PeerZomesProxy( {}, this.#zome.name );
	this.#functions			= new PeerFunctionsProxy( {}, this.#zome.name );
	this.#position			= this.parent?.children.length || 0;

	// Setup for calling peer cells
	this.log.trace("Setup peer cells for CallContext (%s):", this.name, scoped_zome.cells );
	for ( let [role, peer_cell] of Object.entries( scoped_zome.cells ) ) {
	    const zomes_map		= this.#cells[ role ];

	    this.log.trace("Setup zomes for peer cell '%s' for CallContext (%s):", role, this.name, peer_cell.zomes );
	    for ( let [zome_name, cell_zome] of Object.entries( peer_cell.zomes ) ) {
		const funcs_map		= zomes_map[ zome_name ];

		this.log.trace("Setup functions for peer cell::zome '%s::%s' for CallContext (%s):", role, zome_name, this.name, cell_zome.functions );
		for ( let [name, handler] of Object.entries( cell_zome.functions ) ) {
		    funcs_map[ name ]	= this.#heritageWrapper( name, handler );
		}
	    }
	}

	// Setup for calling peer zomes
	for ( let [name, peer_zome] of Object.entries( scoped_zome.zomes ) ) {
	    const funcs_map		= this.#zomes[ name ];

	    for ( let [name, handler] of Object.entries( peer_zome.functions ) ) {
		funcs_map[ name ]	= this.#heritageWrapper( name, handler );
	    }
	}

	// Setup for calling peer functions
	for ( let [name, handler] of Object.entries( scoped_zome.functions ) ) {
	    this.#functions[ name ]	= this.#heritageWrapper( name, handler );
	}
    }

    #heritageWrapper ( name, handler ) {
	const self			= this;

	return async function ( ...args ) {
	    self.log.debug("Wrapped function '%s' in CallContext", name, self );
	    return await handler.call( self, ...args );
	}
    }

    get heritage () {
	return this.#heritage.slice();
    }

    get parent () {
	return this.heritage[ this.heritage.length - 1 ] || null;
    }

    get children () {
	return this.#children.slice();
    }

    get subcall_count () {
	return this.children
	    .map( ctx => ctx.subcall_count )
	    .reduce( (acc, n) => acc + n + 1, 0 );
    }

    get position () {
	return this.#position;
    }

    get depth () {
	return this.heritage.length;
    }

    get func () {
	return this.#func;
    }

    get args () {
	return this.#args || null;
    }

    get args_repr () {
	if ( this.args === null )
	    return ' null ';

	if ( this.args?.constructor?.name === "Object" )
	    return "{ " + Object.keys( this.args ).join(", ") + " }";

	return ` ${this.args?.constructor?.name || typeof this.args} `;
    }

    get repr () {
	return `${this.name}(${this.args_repr || ' ? '})`;
    }

    get start_time () {
	return this.#start_time;
    }

    get end_time () {
	return this.#end_time;
    }

    get duration () {
	return (this.end_time || new Date()) - this.start_time;
    }

    get duration_seconds () {
	return (this.duration / 1000).toFixed(3);
    }

    get cells () {
	return Object.assign( {}, this.#cells );
    }

    get zomes () {
	return Object.assign( {}, this.#zomes );
    }

    get functions () {
	return Object.assign( {}, this.#functions );
    }

    childContext ( scoped_zome, fn_name ) {
	const child_ctx			= new CallContext( scoped_zome, fn_name, this );
	try {
	    return child_ctx;
	} finally {
	    this.#children.push( child_ctx );
	}
    }

    async call ( args, ...extra ) {
	// Should only be able to call 1 time.
	if ( this.end_time )
	    throw new Error(`Call context has already been executed`);

	this.#args			= args;

	try {
	    return await this.#zome.call( this.func, args, ...extra );
	} finally {
	    this.end();
	}
    }

    end () {
	this.#end_time			= new Date();
    }
}
utils.set_tostringtag( CallContext, "CallContext" );


export default {
    ScopedCellZomelets,
    ScopedZomelet,
    CallContext,
};
