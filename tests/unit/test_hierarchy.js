import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-basic", process.env.LOG_LEVEL );

import crypto				from 'crypto';

import { expect }			from 'chai';

import json				from '@whi/json';
import {
    DnaHash,
    AgentPubKey,
}					from '@spartan-hc/holo-hash';

import {
    expect_reject,
    linearSuite,
}					from '../utils.js';
import {
    AppInterfaceClient,
    CellZomelets,
    Zomelet,
}					from '../../src/node.js';


const APP_PORT				= 28746;
const APP_ID				= "some_app_id";

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
	client				= new AppInterfaceClient( APP_PORT, { timeout: 10 });

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
	zome_spec			= new Zomelet({
	    some_zome_fn ( args ) {
		return this.call( args );
	    },
	});

	expect( zome_spec.handlers	).to.have.keys( "some_zome_fn" );
    });

    it("should create cell interface", async function () {
	cell_spec			= new CellZomelets({
	    "zome_01": zome_spec,
	    "zome_02": {
		some_zome_fn ( args ) {
		    return this.call( args );
		},
	    },
	});

	app_client.setCellZomelets( "role_name", cell_spec );

	expect( cell_spec.zomes		).to.have.keys( "zome_01", "zome_02" );
	expect( cell_spec.zomes.zome_01	).to.equal( zome_spec );
    });

    linearSuite("Errors", async function () {

	it("should fail because cell doesn't exist", async function () {
	    await expect_reject(async () => {
		app_client.cells.wrong_cell;
	    }, "Cell 'wrong_cell' does not exist in AppClient");
	});

	it("should fail because zome doesn't exist", async function () {
	    await expect_reject(async () => {
		app_client.cells.role_name.zomes.wrong_zome;
	    }, "Zome 'wrong_zome' does not exist in ScopedCellZomelets");
	});

	it("should fail because function is not defined", async function () {
	    await expect_reject(async () => {
		app_client.cells.role_name.zomes.zome_01.functions.wrong_func;
	    }, "'wrong_func' does not have a defined function in ScopedZomelet");
	});

    });

}

function errors_tests () {
}

describe("Class Hierarchy", () => {

    describe("Basic",		basic_tests );
    describe("Errors",		errors_tests );

});
