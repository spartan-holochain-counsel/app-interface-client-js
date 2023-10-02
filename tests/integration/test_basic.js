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
    DnaHash,
    AgentPubKey,
    EntryHash,
}					from '@spartan-hc/holo-hash';
import HolochainBackdrop		from '@spartan-hc/holochain-backdrop';
const { Holochain }			= HolochainBackdrop;
// import { MereMemoryZomelet }		from '@spartan-hc/mere-memory-sdk';

import {
    expect_reject,
    linearSuite,
}					from '../utils.js';
import {
    AppInterfaceClient,
    CellZomelets,
    // Transformer,
}					from '../../src/node.js';


const __dirname				= path.dirname( new URL(import.meta.url).pathname );
const DNA_PATH				= path.join( __dirname, "../content_dna.dna" );
// const HAPP_PATH				= path.join( __dirname, "../packs/storage.happ" );
const APP_PORT				= 23_567;
let agents				= {};

describe("App Client", function () {
    const holochain			= new Holochain({
	"timeout": 60_000,
	"default_stdout_loggers": process.env.LOG_LEVEL === "trace",
    });

    before(async function () {
	this.timeout( 60_000 );

	const actors			= await holochain.backdrop({
	    "test": { // HAPP_PATH,
		"content": DNA_PATH,
	    },
	}, {
	    "app_port": APP_PORT,
	});

	// console.log( actors );
    });

    linearSuite( "Basic", basic_tests );

    after(async () => {
	await holochain.destroy();
    });
});

// const DNA_NAME				= "storage";
// const MAIN_ZOME				= "mere_memory_api";


// const mere_memory_spec			= new CellZomelets({
//     [MAIN_ZOME]: MereMemoryZomelet,
// }, {
//     "logging": "debug",
// });
const content_spec			= new CellZomelets({
    "content_csr": {
	async create_content ( name, content ) {
	    return await this.call({
		name,
		content,
	    });
	}
    },
}, {
    "logging": "debug",
});

const k					= obj => Object.keys( obj );


function basic_tests () {
    let client;
    let agent_ctx;
    let app_client;

    it("should create app interface client", async function () {
	client				= new AppInterfaceClient( APP_PORT, {
	    // "logging": "warn",
	});

	expect( k(client.agents)	).to.have.length( 0 );
    });

    it("should create app client", async function () {
	app_client			= await client.app( "test-alice" );

	expect( k(client.agents)	).to.have.length( 1 );
	expect( k(app_client.roles)	).to.have.length( 1 );
	expect( k(app_client.cells)	).to.have.length( 1 );
    });

    it("should use a cell interface", async function () {
	this.timeout( 30_000 );

	app_client.setCellZomelets( "content", content_spec );

	const {
	    create_content,
	}				= app_client.cells.content.zomes.content_csr.functions;

	const addr			= await create_content( "greeting", "Hello world" );

	expect( addr			).to.be.a("ActionHash");
    });

    // it("should use a cell interface", async function () {
    // 	this.timeout( 30_000 );

    // 	app_client.setCellZomelets( DNA_NAME, mere_memory_spec );

    // 	const {
    // 	    save,
    // 	    save_bytes,
    // 	    retrieve_bytes,
    // 	}				= app_client.cells.storage.zomes.mere_memory_api.functions;

    // 	{
    // 	    const addr			= await save_bytes( "Hello world" );

    // 	    expect( addr		).to.be.a("EntryHash");

    // 	    const bytes			= await retrieve_bytes( addr.bytes() );

    // 	    expect( bytes		).to.be.a("Uint8Array");

    // 	    const text			= bytes.toString("utf8");

    // 	    expect( text		).to.equal( "Hello world" );
    // 	}

    // 	{
    // 	    const bytes			= crypto.randomBytes( 10_000 );
    // 	    const addr			= await save( bytes );

    // 	    expect( addr		).to.be.a("EntryHash");
    // 	}
    // });

    after(async function () {
	await client.close();
    });
}
