import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-holo-hash-map", process.env.LOG_LEVEL );

import crypto				from 'crypto';

import { expect }			from 'chai';

import json				from '@whi/json';
import {
    HoloHash,
    DnaHash,
    AgentPubKey,
}					from '@spartan-hc/holo-hash';

import { expect_reject }		from '../utils.js';
import {
    HoloHashMap,
}					from '../../src/holo_hash_map.js';


function basic_tests () {

    it("should set agent pubkey using Uint8Array", async function () {
	const agents			= new HoloHashMap();
	const pubkey			= new AgentPubKey( crypto.randomBytes( 32 ) );

	agents.set( pubkey.bytes(), true );

	expect( agents			).to.have.keys( String(pubkey) );
    });

    it("should set agent pubkey using Buffer", async function () {
	const agents			= new HoloHashMap();
	const agent			= new AgentPubKey( crypto.randomBytes( 32 ) );
	const pubkey			= Buffer.from( agent );

	agents.set( pubkey, true );

	expect( agents			).to.have.keys( String(agent) );
    });

}

function errors_tests () {

    it("should fail to handle random bytes", async function () {
	const agents			= new HoloHashMap();
	const bytes			= new Uint8Array( crypto.randomBytes( 39 ) );

	await expect_reject(async () => {
	    agents.set( bytes, true );
	}, "BadPrefixError", "did not match" );
    });

}

describe("Holo Hash Map", () => {

    describe("Basic",		basic_tests );
    describe("Errors",		errors_tests );

});
