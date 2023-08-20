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

import { expect_reject }		from '../utils.js';
import {
    AppInterfaceClient,
    CellInterface,
    ZomeInterface,
}					from '../../src/node.js';


const APP_PORT				= 28746;
const APP_ID				= "some_app_id";
const conn				= new Connection( APP_PORT );

const AGENT_HASH			= new AgentPubKey( crypto.randomBytes(32) );
const DNA_HASH				= new DnaHash( crypto.randomBytes(32) );

const k					= obj => Object.keys( obj );


function basic_tests () {
    let client;
    let agent_ctx;
    let app_client;
    let zome_spec;
    let cell_spec;

    it("should create app interface client", async function () {
	client				= new AppInterfaceClient( conn, { timeout: 10 });

	expect( k(client.agents)	).to.have.length( 0 );
    });

    it("should create agent context", async function () {
	agent_ctx			= client.agent( AGENT_HASH );

	expect( k(client.agents)	).to.have.length( 1 );
    });

    it("should create app client", async function () {
	app_client			= agent_ctx.app( APP_ID, {
	    "role_name": DNA_HASH,
	});

	expect( k(agent_ctx.apps)	).to.have.length( 1 );
	expect( k(app_client.roles)	).to.have.length( 1 );
	expect( k(app_client.cells)	).to.have.length( 1 );
    });

    it("should create zome interface", async function () {
	zome_spec			= new ZomeInterface({
	    some_zome_fn ( args ) {
		return this.call( args );
	    },
	});

	expect( zome_spec.handlers	).to.have.keys( "some_zome_fn" );
    });

    it("should create cell interface", async function () {
	cell_spec			= new CellInterface({
	    "zome_01": zome_spec,
	    "zome_02": {
		some_zome_fn ( args ) {
		    return this.call( args );
		},
	    },
	});

	expect( cell_spec.zomes		).to.have.keys( "zome_01", "zome_02" );
	expect( cell_spec.zomes.zome_01	).to.equal( zome_spec );
    });

}

function errors_tests () {
}

describe("Integration: Agent Client", () => {

    describe("Basic",		basic_tests );
    describe("Errors",		errors_tests );

    after(async function () {
	await conn.close();
    });

});
