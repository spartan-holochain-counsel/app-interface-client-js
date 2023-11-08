import { Logger }			from '@whi/weblogger';
const log				= new Logger("scoped-interfaces", (import.meta.url === import.meta.main) && process.env.LOG_LEVEL );

import json				from '@whi/json';
import {
    CellZomelets,
    Zomelet,
}					from '@spartan-hc/zomelets';

import utils				from './utils.js';
import { Base }				from './base_classes.js';
import {
    ORMProxy,
    CellsProxy,
    ZomesProxy,
    FunctionsProxy,
    PeerCellsProxy,
    PeerZomesProxy,
    PeerFunctionsProxy,
}					from './proxies.js';


export class ScopedCellZomelets extends Base {
    #client				= null;
    #role				= null;
    #spec				= null;
    #zomes				= null;
    #orm				= null;

    constructor ( client, role, cell_spec, options ) {
	if ( arguments[0]?.constructor?.name === "ScopedCellZomelets" )
	    return arguments[0];

	const zomelets			= new CellZomelets( cell_spec );

	// console.log("CellZomelets set options:", zomelets.options, options );
	super( zomelets.options, options );

	this.#client			= client;
	this.#role			= role;
	this.#spec			= zomelets;
	this.#zomes			= new ZomesProxy( {}, `ScopedCellZomelets '${this.role}'` );
	this.#orm			= new ORMProxy( {}, ( name ) => {
	    const tmp_scoped_zome	= this.createZomeInterface( name );

	    return tmp_scoped_zome.orm;
	});

	Object.entries( this.spec.zomes ).forEach( ([name, zome_spec]) => {
	    this.#zomes[ name ]		= this.createZomeInterface( name, zome_spec );
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
	return this.#zomes;
    }

    get orm () {
	return this.#orm;
    }

    createZomeInterface ( name, zome_spec ) {
	return new ScopedZomelet( this, name, zome_spec, this.set_options );
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
    #orm				= null;
    #latest_context			= null;

    constructor ( scoped_cell, name, zome_spec = {}, options ) {
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
	this.#cells			= new CellsProxy( {}, `ScopedZomelet '${this.name}'` );
	this.#zomes			= new ZomesProxy( {}, `ScopedZomelet '${this.name}'` );
	this.#functions			= new FunctionsProxy( {}, `ScopedZomelet '${this.name}'` );
	this.#orm			= new ORMProxy( {}, ( name ) => {
	    function noop_handler ( args ) {
		return this.call( args );
	    }
	    const tmp_scoped_func	= this.#contextWrapper( name, noop_handler );

	    return tmp_scoped_func;
	});

	// Peer cells from the perspective of this zomelet
	this.log.trace("Adding peer cells to Zomelet (%s):", this.name, this.spec.cells );
	for ( let [role_name, cell_spec] of Object.entries( this.spec.cells ) ) {
	    // Create a scoped cell for the role
	    this.log.trace("Adding peer cell '%s' to Zomelet (%s):", role_name, this.name, cell_spec );
	    this.#cells[ role_name ]	= this.cell.client.createCellInterface( role_name, cell_spec );
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

	return async function ( args, options ) {
	    const call_opts		= Object.assign( {}, self.options?.defaultCallOptions, options );
	    // 'this' will either be the parent context or we create a new one
	    const ctx			= this?.constructor?.name === "CallContext"
		  ? this.childContext( self, name, args, call_opts )
		  : new CallContext( self, name, args, call_opts );
	    self.log.debug("Begin call %s", ctx.repr );

	    try {
		// 'options' is read-only but will override any options set by the handler
		const result		= await handler.call( ctx, args, call_opts );
		ctx.treeLog();

		// Allows access to the CallContext after call finishes
		self.#latest_context	= ctx;

		return result;
	    } catch (err) {
		ctx.treeLog( err );

		if ( err.message.includes("Failed to deserialize input for") )
		    ctx.log.error("%s(%s)", ctx.name, json.debug(args) );

		throw err;
	    } finally {
		ctx.end();
		self.log.debug("End call context %s", ctx.repr );
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
	return this.#cells;
    }

    get zomes () {
	return this.#zomes;
    }

    get functions () {
	return this.#functions;
    }

    get orm () {
	return this.#orm;
    }

    prevCall () {
	return this.#latest_context;
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
    #call_options			= {};
    #start_time				= null;
    #end_time				= null;
    #position				= null;
    #children				= [];
    #cells				= null;
    #zomes				= null;
    #functions				= null;
    #tree				= [];

    constructor ( scoped_zome, fn_name, args = null, call_options, parent_ctx ) {
	super( scoped_zome.set_options );

	if ( parent_ctx ) {
	    this.log.debug("Parent context:", parent_ctx );
	    this.#heritage.push( ...parent_ctx.heritage, parent_ctx );
	}

	this.name			= `${scoped_zome.cell.role}::${scoped_zome.name}->${fn_name}`;
	this.#cell			= scoped_zome.cell;
	this.#zome			= scoped_zome;
	this.#func			= fn_name;
	this.#args			= args;
	Object.assign( this.#call_options, call_options );
	this.#start_time		= new Date();
	this.#cells			= new PeerCellsProxy( {}, this.zome.name );
	this.#zomes			= new PeerZomesProxy( {}, this.zome.name );
	this.#functions			= new PeerFunctionsProxy( {}, this.zome.name );
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

    // Wraps a handler function to ensure 'this' CallContext is the parent of all subcalls
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

    get position () {
	return this.#position;
    }

    get depth () {
	return this.heritage.length;
    }

    get cell () {
	return this.#cell;
    }

    get zome () {
	return this.#zome;
    }

    get func () {
	return this.#func;
    }

    get args () {
	return this.#args;
    }

    get call_options () {
	return Object.assign( {}, this.#call_options );
    }

    get args_repr () {
	if ( this.args === null )
	    return ' null ';

	if ( this.args?.constructor?.name === "Object" )
	    return "{ " + Object.keys( this.args ).join(", ") + " }";

	return ` ${this.args?.constructor?.name || typeof this.args} `;
    }

    get repr () {
	return `${this.name}(${this.args_repr})`;
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

    get cells () {
	return Object.assign( {}, this.#cells );
    }

    get zomes () {
	return Object.assign( {}, this.#zomes );
    }

    get functions () {
	return Object.assign( {}, this.#functions );
    }

    get tree () {
	return this.#tree.slice();
    }

    durationSeconds () {
	return (this.duration / 1000).toFixed(3);
    }

    subcallCount () {
	return this.children
	    .map( ctx => ctx.subcallCount() )
	    .reduce( (acc, n) => acc + n + 1, 0 );
    }

    printTree ( color = true ) {
	for ( let [ prefix, msg, err ] of this.tree ) {
	    let text			= `${prefix}${msg}`;

	    if ( err ) {
		text			= `${text} (error: ${err.name})`;
		if ( this.call_options?.colorTree === false || color === false )
		    console.log( text );
		else
		    utils.print( text, "error" );
	    }
	    else {
		if ( this.call_options?.colorTree === false || color === false )
		    console.log( text );
		else
		    utils.print( text );
	    }
	}
    }

    treeLog ( err ) {
	const msg			= `${this.durationSeconds()}s to finish call #${this.position} with ${this.subcallCount()} subcalls; ${this.repr}`;

	this.addTreeLog( msg, err );

	return msg;
    }

    addTreeLog ( msg, err = null, prefix = "" ) {
	this.#tree.push([ prefix, msg , err ]);

	// If this context has a parent, we need to pass the tree log upwards and add the prefix.
	if ( this.parent ) {
	    // If the current prefix is blank we need to add directional box characters, otherwise
	    // we just add the pipe.
	    let indent			= prefix === ""
		? (this.position ? '├─ ' : '┌─ ')
		: (this.position > 0 ? `│  ` : "   ");

	    this.parent.addTreeLog( msg, err, `${indent}${prefix}` );
	}
	else {
	    // Top context should be the only one who logs.  Otherwise, there would be many
	    // duplicate logs
	    if ( err )
		this.log.error("%s%s; Failure: %s", prefix, msg, String(err) );
	    else
		this.log.normal("%s%s", prefix, msg );
	}
    }

    childContext ( scoped_zome, fn_name, args, options ) {
	// Inherit current options but allow override
	const inherited_options		= Object.assign( this.call_options, options );
	const child_ctx			= new CallContext( scoped_zome, fn_name, args, inherited_options, this );
	try {
	    return child_ctx;
	} finally {
	    this.#children.push( child_ctx );
	}
    }

    // Note: virtual functions are functions that don't run this
    async call ( args = null, options ) {
	// Should only be able to call 1 time.
	if ( this.end_time )
	    throw new Error(`Call context has already been executed`);

	this.#args			= args;

	if ( typeof options === "number" )
	    options			= { "timeout": options };

	return await this.#zome.call( this.func, args, options );
    }

    end () {
	if ( this.end_time )
	    throw new Error(`Call context has already been ended`);

	this.#end_time			= new Date();

	if ( !this.parent && this.call_options?.printFinalTree )
	    this.printTree();
    }
}
utils.set_tostringtag( CallContext, "CallContext" );


export default {
    ScopedCellZomelets,
    ScopedZomelet,
    CallContext,
};
