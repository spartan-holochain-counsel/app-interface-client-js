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
}					from '@spartan-hc/holo-hash';
import HolochainBackdrop		from '@spartan-hc/holochain-backdrop';
const { Holochain }			= HolochainBackdrop;

import {
    expect_reject,
    linearSuite,
}					from '../utils.js';
import {
    AppInterfaceClient,
    CellInterface,
    ZomeInterface,
}					from '../../src/node.js';


const __dirname				= path.dirname( new URL(import.meta.url).pathname );
const HAPP_PATH				= path.join( __dirname, "../packs/storage.happ" );
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
	    "test": HAPP_PATH,
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

const DNA_NAME				= "storage";
const MAIN_ZOME				= "mere_memory_api";

const mere_memory_spec			= new CellInterface({
    [MAIN_ZOME]: {
	save_bytes ( args ) {
	    console.log( this );
	    return this.call( args );
	},
    },
});

const k					= obj => Object.keys( obj );


function basic_tests () {
    let client;
    let agent_ctx;
    let app_client;

    it("should create app interface client", async function () {
	client				= new AppInterfaceClient( APP_PORT );

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
	console.log( app_client.roles );

	app_client.setCellInterface( DNA_NAME, mere_memory_spec );

	console.log( app_client.cells );
	const {
	    storage,
	}				= app_client.cells;
	console.log( storage.zomes );
	const {
	    mere_memory_api,
	}				= storage.zomes;
	console.log( mere_memory_api.functions );
	const {
	    save_bytes,
	}				= mere_memory_api.functions;

	const addr			= await save_bytes( "Hello world" );

	expect( addr			).to.be.a("EntryHash");
    });

    after(async function () {
	await client.close();
    });
}
