import { Logger }			from '@whi/weblogger';
const log				= new Logger("scoped-interfaces", (import.meta.url === import.meta.main) && process.env.LOG_LEVEL );

import json				from '@whi/json';
import { encode, decode }		from '@msgpack/msgpack';
import {
    DnaHash,
}					from '@spartan-hc/holo-hash';
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
    #is_virtual				= null;
    #dna				= null;
    #spec				= null;
    #zomes				= null;
    #orm				= null;

    constructor ( client, role, virtual, dna, cell_spec, options ) {
	if ( arguments[0]?.constructor?.name === "ScopedCellZomelets" )
	    return arguments[0];

	const zomelets			= new CellZomelets( cell_spec );

	if ( dna !== null )
	    dna				= new DnaHash( dna );

	// console.log("CellZomelets set options:", zomelets.options, options );
	super( zomelets.options, options );

	this.#client			= client;
	this.#role			= role;
	this.#is_virtual		= !!virtual;
	this.#dna			= dna;
	this.#spec			= zomelets;
	this.#zomes			= new ZomesProxy( {}, `ScopedCellZomelets '${this.role}'` );
	this.#orm			= new ORMProxy( {}, ( name ) => {
	    const tmp_scoped_zome	= this.createZomeInterface( name );

	    return tmp_scoped_zome.orm;
	});

	Object.entries( this.spec.zomes ).forEach( ([name, zome_spec]) => {
	    this.#zomes[ name ]		= this.createZomeInterface( name, zome_spec );
	});

	this.client.on(`signal/${this.role}`, payload => {
	    this.log.debug("%s - recv signal (role: %s)", "?", this.role );
	    const event_name		= `signal/${payload.zome}`
	    this.emit( event_name, payload );
	    this.log.debug("%s - emit signal 'signal/%s' to %s listeners", () => [
		"?", this.role, this.listenerCount( event_name ) ]);
	});
    }

    get client () {
	return this.#client;
    }

    get role () {
	return this.#role;
    }

    get is_virtual () {
	return this.#is_virtual;
    }

    get dna () {
	return this.#dna;
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

    async call ( ctx, ...args ) {
	// If the role maps to a virtual cell, we must throw a "VirtualCellError"
	if ( this.dna === null )
	    throw new Error(`Virtual cells cannot be called directly; use <AppClient>.createVirtualCellInterface( ... ) instead`);

	const input			= await this.spec.processInput( args ) || args;
	const output			= this.is_virtual
	      ? await this.client.callVirtual( ctx, this.role, this.dna, ...input )
	      : await this.client.call( this.role, ...input );

	return await this.spec.processOutput( output );
    }
}
utils.set_tostringtag( ScopedCellZomelets );


export class ScopedZomelet extends Base {
    #cell				= null;
    #name				= null;
    #spec				= null;
    #cells				= null;
    #zomes				= null;
    #functions				= null;
    #virtual				= {
	"cells": {},
    };
    #virtual_dnas			= null;
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
	this.#virtual_dnas		= new CellsProxy( {}, `ScopedZomelet '${this.name}'` );
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
	    this.#cells[ role_name ]	= this.cell.client.createCellInterface(
		role_name, cell_spec
	    );
	}

	// Peer zomes from the perspective of this zomelet
	for ( let [name, peer_spec] of Object.entries( this.spec.zomes ) ) {
	    this.#zomes[ name ]		= new ScopedZomelet(
		scoped_cell, name, peer_spec, this.set_options
	    );
	}
	this.log.debug("ScopedZomelet '%s' has %s peer zomes: %s", () => [
	    this.name, Object.keys(this.zomes).length, Object.keys(this.zomes)
	]);

	for ( let [name, handler] of Object.entries( this.spec.functions ) ) {
	    this.#functions[ name ]	= this.#contextWrapper( name, handler );
	}

	if ( this.spec.virtual_cells ) {
	    // Virtual peer cells from the perspective of this zomelet
	    this.log.trace("Adding virtual peer cells to Zomelet (%s):", this.name, this.spec.virtual_cells );
	    for ( let [role_name, cell_spec] of Object.entries( this.spec.virtual_cells ) ) {
		this.log.trace("Adding virtual peer cell '%s' to Zomelet (%s):", () => [
		    role_name, this.name, cell_spec
		]);

		const virtual_cell	= this.cell.client.createVirtualCellInterface(
		    role_name, cell_spec
		);

		this.#virtual.cells[ role_name ] = ( dna ) => {
		    this.log.trace("Checking virtual DNAs for '%s'", dna );
		    if ( dna in this.#virtual_dnas )
			return this.#virtual_dnas[ dna ];

		    const scoped_cell	= virtual_cell( dna );

		    this.#virtual_dnas[ dna ] = scoped_cell;

		    return scoped_cell;
		};
	    }
	}

	if ( this.spec.signals ) {
	    this.cell.on(`signal/${this.name}`, ({ signal }) => {
		try {
		    this.log.debug("%s - recv signal (zome: %s)", "?", this.name );
		    const handler		= this.spec.signals[ signal.type ];

		    if ( typeof handler === "function" )
			handler( decode(encode(signal.data)) );
		} catch (err) {
		    console.log(err);
		}
	    });
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

    get virtual () {
	return Object.assign( {}, this.#virtual );
    }

    get orm () {
	return this.#orm;
    }

    prevCall () {
	return this.#latest_context;
    }

    async call ( ctx, ...args ) {
	this.log.trace("ScopedZomelet: %s", this.name );
	const input			= await this.spec.processInput( args ) || args;
	const output			= await this.cell.call( ctx, this.name, ...input ) ;

	return await this.spec.processOutput( output );
    }
}
utils.set_tostringtag( ScopedZomelet );


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
    #virtual				= {
	"cells": {},
    };
    #virtual_cells			= null;
    #virtual_dnas			= null;
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
	this.#virtual_cells		= new PeerCellsProxy( {}, this.zome.name );
	this.#virtual_dnas		= new CellsProxy( {}, `CallContext '${this.name}'` );
	this.#position			= this.parent?.children.length || 0;

	// IDEA:
	//   - `this.cells[ role ]()` - expects peer cell
	//   - `this.cells[ role ]( dna )` - expects a virtual peer cell but returns a peer cell if one matches

	// Setup for calling peer cells
	this.#cellsHeritageWrapper( this.#cells, scoped_zome.cells );

	// Setup for calling peer zomes
	this.#zomesHeritageWrapper( this.cell.role, this.#zomes, scoped_zome.zomes );

	// Setup for calling peer functions
	this.#functionsHeritageWrapper( this.#functions, scoped_zome.functions );

	// Setup for calling virtual peer cells
	this.log.trace("Setup virtual peer cells for CallContext (%s):", () => [
	    this.name, scoped_zome.virtual.cells
	]);
	Object.entries( scoped_zome.virtual.cells ).forEach( ([role, virtual_cell_init]) => {
	    this.#virtual.cells[ role ] = ( dna ) => {
		// Don't run setup again if the virtual cell was already initialized for the given
		// DNA hash
		if ( dna in this.#virtual_dnas )
		    return this.#virtual_cells[ dna ];

		this.log.trace("Setup virtual peer cell '%s' [%s] for CallContext (%s)", () => [
		    role, dna, this.name
		]);
		const peer_cell		= virtual_cell_init( dna );

		// Remember the cell instance scoped to the given DNA
		this.#virtual_dnas[ dna ] = peer_cell;

		const zomes_map		= this.#virtual_cells[ dna ];

		this.#zomesHeritageWrapper( role, zomes_map, peer_cell.zomes );

		return zomes_map;
	    };
	});
    }

    #cellsHeritageWrapper ( cells_map, source ) {
	this.log.trace("Setup peer cells for CallContext (%s):", this.name, source );
	for ( let [role, peer_cell] of Object.entries( source ) ) {
	    this.log.trace("Setup zomes for peer cell '%s' for CallContext (%s):", () => [
		role, this.name, peer_cell.zomes
	    ]);
	    this.#zomesHeritageWrapper( role, cells_map[ role ], peer_cell.zomes );
	}
    }

    #zomesHeritageWrapper ( role, zomes_map, source ) {
	this.log.trace("Setup peer zomes for CallContext (%s):", this.name, source );
	for ( let [zome_name, cell_zome] of Object.entries( source ) ) {
	    this.log.trace("Setup functions for peer cell::zome '%s::%s' for CallContext (%s):", () => [
		role, zome_name, this.name, cell_zome.functions
	    ]);
	    this.#functionsHeritageWrapper( zomes_map[ zome_name ], cell_zome.functions );
	}
    }

    #functionsHeritageWrapper ( target, source ) {
	this.log.trace("Setup peer functions for CallContext (%s):", this.name, source );
	for ( let [key, handler] of Object.entries( source ) ) {
	    target[ key ]		= this.#heritageWrapper( key, handler );
	}
    }

    // Wraps a handler function to ensure 'this' CallContext is the parent of all subcalls
    #heritageWrapper ( name, handler ) {
	const self			= this;

	return async function ( ...args ) {
	    const $this			= this?.constructor?.name === "CallContext"
		  ? this
		  : self;
	    $this.log.debug("Wrapped function '%s' in CallContext", name, $this );
	    return await handler.call( $this, ...args );
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

    get virtual () {
	return Object.assign( {}, this.#virtual );
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
	// Only track logs if this call context has not been ended
	if ( this.end_time )
	    return;

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
	if ( this.end_time )
	    throw new Error(`Cannot create subcalls after context has ended`);

	// Inherit current options but allow override
	const inherited_options		= Object.assign( this.call_options, options );
	const child_ctx			= new CallContext( scoped_zome, fn_name, args, inherited_options, this );
	try {
	    return child_ctx;
	} finally {
	    this.#children.push( child_ctx );
	}
    }

    getCellInterface ( role, dna ) {
	// If the DNA matches our peer cell, we can call it directly
	if ( role in this.zome.cells && String(this.zome.cells[ role ].dna) == String(dna) )
	    return this.cells[ role ];
	else
	    return this.virtual.cells[ role ]( dna );
    }

    // Note: virtual functions are functions that don't run this
    async call ( args = null, options ) {
	// Should only be able to call 1 time.
	if ( this.end_time )
	    throw new Error(`Call context has already been executed`);

	this.#args			= args;

	if ( typeof options === "number" )
	    options			= { "timeout": options };

	return await this.#zome.call( this, this.func, args, options );
    }

    cancel () {
	if ( this.end_time === null )
	    this.end();
    }

    end () {
	if ( this.end_time )
	    throw new Error(`Call context has already been ended`);

	this.#end_time			= new Date();

	for ( let subcall of this.children ) {
	    subcall.cancel();
	}

	if ( !this.parent && this.call_options?.printFinalTree )
	    this.printTree();
    }
}
utils.set_tostringtag( CallContext );


export default {
    ScopedCellZomelets,
    ScopedZomelet,
    CallContext,
};
