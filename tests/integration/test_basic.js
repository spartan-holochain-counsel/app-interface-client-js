import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-basic", process.env.LOG_LEVEL );

import why				from 'why-is-node-running';

import path				from 'path';
import crypto				from 'crypto';

import { expect }			from 'chai';

import json				from '@whi/json';
import { Connection }			from '@spartan-hc/holochain-websocket';
import {
    HoloHash,
    DnaHash, AgentPubKey,
    ActionHash, EntryHash,
}					from '@spartan-hc/holo-hash';
import HolochainBackdrop		from '@spartan-hc/holochain-backdrop';
const { Holochain }			= HolochainBackdrop;

import {
    expect_reject,
    linearSuite,
}					from '../utils.js';
import {
    AppInterfaceClient,
    CellZomelets,
}					from '../../src/node.js';


const __dirname				= path.dirname( new URL(import.meta.url).pathname );
const DNA_PATH				= path.join( __dirname, "../content_dna.dna" );
let agents				= {};
let app_port;

describe("App Client", function () {
    const holochain			= new Holochain({
	"timeout": 60_000,
	"default_stdout_loggers": log.level_rank > 3,
    });

    before(async function () {
	this.timeout( 60_000 );

	const actors			= await holochain.install([
	    "alice",
	], {
	    "app_name": "test",
	    "bundle": {
		"content": DNA_PATH,
	    },
	});

	app_port			= await holochain.ensureAppPort();
    });

    linearSuite("Basic", basic_tests );

    after(async () => {
	await holochain.destroy();
    });
});


const content_csr_spec			= {
    async create_content ( input ) {
	return new ActionHash( await this.call( input ) );
    },
    async hash_content ( input ) {
	return new EntryHash( await this.call( input ) );
    },
    async get_content ({ id }) {
	return await this.call({
	    "id": new ActionHash( id ),
	});
    },
    async get_content_by_hash ( input ) {
	return await this.call( new EntryHash( input ) );
    },

    // Virtual function
    async content ( input, options ) {
	const entry_hash		= await this.functions.hash_content( input );
	try {
	    return await this.functions.get_content_by_hash( entry_hash );
	} catch (err) {
	    this.log.error( String(err) );
	    return await this.functions.create_content( input );
	}
    },
};

const content_spec			= new CellZomelets({
    "content_csr": {
	async create_content ( input ) {
	    return new ActionHash( await this.call( input ) );
	},
	async hash_content ( input ) {
	    return new EntryHash( await this.call( input ) );
	},
	async get_content ({ id }) {
	    return await this.call({
		"id": new ActionHash( id ),
	    });
	},
	async get_content_by_hash ( input ) {
	    return await this.call( new EntryHash( input ) );
	},

	// Virtual function
	async content ( input, options ) {
	    const entry_hash		= await this.functions.hash_content( input );
	    try {
		return await this.functions.get_content_by_hash( entry_hash );
	    } catch (err) {
		this.log.error( String(err) );
		return await this.functions.create_content( input );
	    }
	},
    },
}, null, {
    // "logging": "debug",
});

const k					= obj => Object.keys( obj );


function basic_tests () {
    let client;
    let agent_ctx;
    let app_client;
    let content, content_csr;
    let content_zome;

    it("should create app interface client", async function () {
	client				= new AppInterfaceClient( app_port, {
	    "logging": process.env.LOG_LEVEL || "normal",
	});

	expect( k(client.agents)	).to.have.length( 0 );
    });

    it("should create app client", async function () {
	app_client			= await client.app( "test-alice" );

	expect( k(client.agents)	).to.have.length( 1 );
	expect( k(app_client.roles)	).to.have.length( 1 );
    });

    it("should initialize test DNA", async function () {
	this.timeout( 30_000 );
	await app_client.call( "content", "content_csr", "whoami" );
    });

    it("should use ORM interface", async function () {
	const content			= {
	    "name": "intro",
	    "content": "Welcome!",
	};
	const addr			= await app_client.orm.content.content_csr.create_content( content );

	expect( addr			).to.be.a("Uint8Array");

	expect( k(app_client.orm.content)		).to.have.length( 1 );
	expect( k(app_client.orm.content.content_csr)	).to.have.length( 1 );
    });

    it("should setup a cell interface", async function () {
	content				= app_client.createCellInterface( "content", content_spec );
	({
	    content_csr,
	}				= content.zomes);
	content_zome			= content_csr.functions;
    });

    it("should use a cell interface", async function () {
	this.timeout( 30_000 );

	const content			= {
	    "name": "greeting",
	    "content": "Hello world",
	};
	const addr			= await content_zome.content( content );
	// content_csr.prevCall().printTree( true ); // color
	expect( addr			).to.be.a("ActionHash");

	const result			= await content_zome.get_content({ "id": addr });
	expect( result			).to.deep.equal( content );
    });

    after(async function () {
	await client.close();
    });
}
