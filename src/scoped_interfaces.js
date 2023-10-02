import { Logger }			from '@whi/weblogger';
const log				= new Logger("scoped-interfaces", (import.meta.url === import.meta.main) && process.env.LOG_LEVEL );

import utils				from './utils.js';
import { Base }				from './base_classes.js';
import {
    CellZomelets,
    Zomelet,
}					from '@spartan-hc/zomelets';


export class ScopedCellZomelets extends Base {
    #client				= null;
    #role				= null;
    #spec				= null;
    #zomes				= {};

    constructor ( client, role, cell_spec, opts ) {
	if ( arguments[0]?.constructor?.name === "ScopedCellZomelets" )
	    return arguments[0];

	const zomelets			= new CellZomelets( cell_spec );

	super( Object.assign({}, zomelets.opts, opts ) );

	this.#client			= client;
	this.#role			= role;
	this.#spec			= zomelets;

	Object.entries( this.spec.zomes ).forEach( ([name, zome_spec]) => {
	    this.#zomes[ name ]		= new ScopedZomelet( this, name, zome_spec, this.opts );
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
    #functions				= {};

    constructor ( scoped_cell, name, zome_spec, options ) {
	if ( arguments[0]?.constructor?.name === "ScopedZomelet" )
	    return arguments[0];

	const zomelet			= new Zomelet( zome_spec );

	super( zomelet.options, options );

	utils.assert( name, "string" );
	this.log.trace("ScopedZomelet", ...arguments );

	this.#cell			= scoped_cell;
	this.#name			= name;
	this.#spec			= zomelet;

	const self			= this;
	Object.entries( this.spec.handlers ).forEach( ([name, handler]) => {
	    this.#functions[ name ]	= async function ( ...args ) {
		const ctx		= new CallContext( self, name );
		try {
		    return await handler.apply( ctx, args );
		} finally {
		    ctx.end();
		    self.log.info("%ss to finish call %s->%s", (ctx.duration / 1000).toFixed(3), self.name, name );
		}
	    };
	});
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

    get functions () {
	return Object.assign( {}, this.#functions );
    }

    async callLocal ( zome_name, fn_name, ...args ) {
	return await this.cell.zomes[ zome_name ].functions[ fn_name ]( ...args );
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
    #zome				= null;
    #func				= null;
    #start_time				= null;
    #end_time				= null;

    constructor ( scoped_zome, fn_name ) {
	super();

	this.#zome			= scoped_zome;
	this.#func			= fn_name;
	this.#start_time		= new Date();

	// const req_ctx		= {
	//     "dna": dna_role_name,
	//     "input": payload,
	//     "timeout": timeout,
	// };
    }

    get zome () {
	return this.#zome;
    }

    get func () {
	return this.#func;
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

    async callLocal ( ...args ) {
	return await this.zome.callZome( ...args );
    }

    async callFunction ( fn_name, ...args ) {
	return await this.zome.functions[ fn_name ]( ...args );
    }

    async call ( ...args ) {
	return await this.zome.call( this.func, ...args );
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
